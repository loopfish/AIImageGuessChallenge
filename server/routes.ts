import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { setupWebsocketHandlers } from "./websocket";
// Import the simplified Gemini image implementation
import { generateImage } from "./gemini-image";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { testGeminiImageGeneration } from "./test-gemini-image";
import { renderTestPage } from "./test-page";
import { testImageGeneration } from "./api-test";
import { renderFixedTestPage } from "./fixed-test-page";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create a WebSocket server on a specific path and make sure to log connections
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true  // Enable client tracking
  });
  
  // Log WebSocket server events
  wss.on('listening', () => {
    console.log('WebSocket server is listening');
  });
  
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
  
  // Setup WebSocket message handlers
  setupWebsocketHandlers(wss, storage);

  // API routes
  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok" });
  });
  
  // Test route to create a game with predictable code
  app.get("/api/test/create-game", async (req, res) => {
    try {
      const gameCode = "TESTGAME"; // Fixed game code for testing
      const username = req.query.username?.toString() || "TestUser";
      const timerSeconds = parseInt(req.query.timer?.toString() || "60");
      const totalRounds = parseInt(req.query.rounds?.toString() || "5");
      
      // Check if a game with this code already exists
      let game = await storage.getGameByCode(gameCode);
      
      if (!game) {
        // Create a new user or get existing one
        let user = await storage.getUserByUsername(username);
        if (!user) {
          user = await storage.createUser({ username, password: "placeholder" });
        }
        
        // Create the game
        game = await storage.createGame({
          code: gameCode,
          hostId: user.id,
          status: "lobby",
          currentRound: 1,
          totalRounds,
          timerSeconds,
        });
        
        // Create player (the host)
        await storage.createPlayer({
          gameId: game.id,
          userId: user.id,
          username: user.username,
          score: 0,
          isHost: true,
          isActive: true
        });
        
        console.log(`Test game created with code: ${gameCode} by ${username}`);
      } else {
        console.log(`Test game with code ${gameCode} already exists`);
      }
      
      return res.json({ 
        success: true, 
        message: `Game with code ${gameCode} is ready to join`, 
        gameCode 
      });
    } catch (error) {
      console.error("Error creating test game:", error);
      return res.status(500).json({ success: false, message: "Failed to create test game" });
    }
  });
  
  // Test route to join a game with predictable code
  app.get("/api/test/join-game", async (req, res) => {
    try {
      const gameCode = "TESTGAME"; // Fixed game code for testing
      const username = req.query.username?.toString() || "TestPlayer";
      
      // Check if the game exists
      const game = await storage.getGameByCode(gameCode);
      if (!game) {
        return res.status(404).json({
          success: false,
          message: `Game with code ${gameCode} not found. Please create it first.`
        });
      }
      
      // Create or get user
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({ username, password: "placeholder" });
      }
      
      // Check if user is already in the game
      const existingPlayer = await storage.getPlayerByGameAndUser(game.id, user.id);
      let player;
      
      if (existingPlayer) {
        // Update player to active
        player = await storage.updatePlayer(existingPlayer.id, { isActive: true });
        console.log(`Existing player ${existingPlayer.username} updated to active for game ${gameCode}`);
      } else {
        // Create new player
        player = await storage.createPlayer({
          gameId: game.id,
          userId: user.id,
          username,
          score: 0,
          isHost: false,
          isActive: true
        });
        console.log(`Test player ${username} joined game ${gameCode}`);
      }
      
      return res.json({
        success: true,
        message: `Successfully joined game ${gameCode} as ${username}`,
        gameCode,
        playerId: player.id
      });
    } catch (error) {
      console.error("Error joining test game:", error);
      return res.status(500).json({ success: false, message: "Failed to join test game" });
    }
  });
  
  // Generate image API endpoint
  app.post("/api/generate-image", async (req, res) => {
    try {
      // Validate the request body
      const promptSchema = z.object({
        prompt: z.string().min(1).max(500)
      });
      
      const parseResult = promptSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.format() 
        });
      }
      
      const { prompt } = parseResult.data;
      console.log(`Generating image for prompt: "${prompt}"`);
      
      // Generate the image using Gemini
      const imageUrl = await generateImage(prompt);
      
      // Return the image URL to the client
      return res.json({ imageUrl });
    } catch (error) {
      console.error("Error generating image:", error);
      return res.status(500).json({ message: "Failed to generate image" });
    }
  });

  // Get game by code
  app.get("/api/games/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const game = await storage.getGameByCode(code);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Get players for the game
      const players = await storage.getPlayersByGameId(game.id);
      
      // Get current round if game is in playing status
      let currentRound = null;
      if (game.status === "playing") {
        currentRound = await storage.getCurrentRound(game.id);
      }
      
      res.json({ game, players, currentRound });
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // Get game state API (useful for initial page load)
  app.get("/api/games/:code/state", async (req, res) => {
    try {
      const { code } = req.params;
      const game = await storage.getGameByCode(code);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Get players for the game
      const players = await storage.getPlayersByGameId(game.id);
      
      let currentRound = undefined;
      let playerGuesses = undefined;
      let roundResults = undefined;
      
      // Get current round if game is in playing status
      if (game.status === "playing" || game.status === "round_end") {
        currentRound = await storage.getCurrentRound(game.id);
        
        if (currentRound) {
          playerGuesses = await storage.getGuessesByRoundId(currentRound.id);
          roundResults = await storage.getRoundResultByRoundId(currentRound.id);
        }
      }
      
      res.json({ 
        game, 
        players, 
        currentRound, 
        playerGuesses, 
        roundResults 
      });
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ message: "Failed to fetch game state" });
    }
  });

  // Simple landing page with game joining instructions
  app.get("/test-game", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Image Guessing Game - Test</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          input, button {
            padding: 10px;
            font-size: 16px;
          }
          button {
            cursor: pointer;
            background: #5D3FD3;
            color: white;
            border: none;
            border-radius: 4px;
          }
          .result {
            margin-top: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 4px;
          }
          .game-code {
            font-size: 24px;
            font-weight: bold;
            background: #333;
            color: white;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            margin: 10px 0;
          }
          .hidden {
            display: none;
          }
        </style>
      </head>
      <body>
        <h1>AI Image Guessing Game - Test Environment</h1>
        <p>Use this page to create a test game with a fixed game code that's easy to join from other devices.</p>
        
        <div class="container">
          <div class="form-group">
            <label for="username">Your Username:</label>
            <input type="text" id="username" placeholder="Enter your username" value="TestUser">
          </div>
          
          <button id="create-game">Create Test Game</button>
          <button id="join-game">Join Test Game</button>
          
          <div id="result" class="result hidden">
            <h2>Game Created!</h2>
            <p>You can now join this game using the code:</p>
            <div class="game-code">TESTGAME</div>
            <p>Share this code with other players to join the game.</p>
            <button id="go-to-game">Go to Game</button>
          </div>
        </div>
        
        <script>
          document.getElementById('create-game').addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            
            if (!username) {
              alert('Please enter a username');
              return;
            }
            
            try {
              const response = await fetch('/api/test/create-game?username=' + encodeURIComponent(username));
              const data = await response.json();
              
              if (data.success) {
                document.getElementById('result').classList.remove('hidden');
              } else {
                alert('Error: ' + data.message);
              }
            } catch (error) {
              alert('Failed to create game: ' + error.message);
            }
          });
          
          document.getElementById('join-game').addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            
            if (!username) {
              alert('Please enter a username');
              return;
            }
            
            try {
              // First call the join test endpoint
              const response = await fetch('/api/test/join-game?username=' + encodeURIComponent(username));
              const data = await response.json();
              
              if (data.success) {
                // Then redirect to the game join page
                window.location.href = '/#/join/TESTGAME';
              } else {
                alert('Error: ' + data.message);
              }
            } catch (error) {
              alert('Failed to join game: ' + error.message);
            }
          });
          
          document.getElementById('go-to-game').addEventListener('click', () => {
            window.location.href = '/#/host/TESTGAME';
          });
        </script>
      </body>
      </html>
    `);
  });

  // Test page for Gemini image generation
  app.get("/test-gemini-image", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gemini Image Generation Test</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          input, button, select {
            padding: 10px;
            font-size: 16px;
          }
          button {
            cursor: pointer;
            background: #5D3FD3;
            color: white;
            border: none;
            border-radius: 4px;
          }
          .result {
            margin-top: 20px;
            display: none;
          }
          .image-container {
            margin-top: 20px;
            border: 1px solid #ddd;
            padding: 10px;
          }
          img {
            max-width: 100%;
          }
          .logs {
            margin-top: 20px;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <h1>Gemini Image Generation Test</h1>
        <div class="container">
          <div class="form-group">
            <label for="model">Gemini Model:</label>
            <select id="model">
              <option value="gemini-2.0-flash-experimental">gemini-2.0-flash-experimental (for image generation)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </select>
          </div>
          <div class="form-group">
            <label for="prompt">Image Prompt:</label>
            <input type="text" id="prompt" placeholder="A cat wearing sunglasses on a beach" value="A sheep playing tennis on the moon">
          </div>
          <button id="generate">Generate Image</button>
          <div class="logs" id="logs"></div>
          <div class="result" id="result">
            <h2>Generated Image:</h2>
            <div class="image-container">
              <img id="generated-image" src="" alt="Generated image will appear here">
            </div>
            <div id="raw-response" class="mt-4">
              <h3>Raw Response:</h3>
              <pre id="response-text"></pre>
            </div>
          </div>
        </div>

        <script>
          const logElement = document.getElementById('logs');
          const resultElement = document.getElementById('result');
          const imageElement = document.getElementById('generated-image');
          const responseTextElement = document.getElementById('response-text');
          
          function log(message) {
            const logLine = document.createElement('div');
            logLine.textContent = message;
            logElement.appendChild(logLine);
            logElement.scrollTop = logElement.scrollHeight;
          }

          document.getElementById('generate').addEventListener('click', async () => {
            const prompt = document.getElementById('prompt').value;
            const model = document.getElementById('model').value;
            
            if (!prompt) {
              log('Please enter a prompt');
              return;
            }
            
            log(\`Generating image for prompt: "\${prompt}" using model \${model}...\`);
            resultElement.style.display = 'none';
            
            try {
              const response = await fetch('/api/test-gemini-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt, model })
              });
              
              if (!response.ok) {
                throw new Error(\`Server error: \${response.status}\`);
              }
              
              const data = await response.json();
              log('Response received from server');
              
              if (data.error) {
                log(\`Error: \${data.error}\`);
                return;
              }
              
              // Show raw response
              if (data.rawResponse) {
                responseTextElement.textContent = data.rawResponse;
                log(\`Raw response length: \${data.rawResponse.length} characters\`);
              }
              
              if (data.imageUrl) {
                log(\`Image URL: \${data.imageUrl}\`);
                imageElement.src = data.imageUrl;
                resultElement.style.display = 'block';
              } else {
                log('No image URL found in response');
                
                // Try to find URLs in the text ourselves
                const urlMatch = data.rawResponse?.match(/https?:\\/\\/\\S+\\.(jpg|jpeg|png|gif|webp)/i);
                if (urlMatch) {
                  const imageUrl = urlMatch[0];
                  log(\`Found image URL in response: \${imageUrl}\`);
                  imageElement.src = imageUrl;
                  resultElement.style.display = 'block';
                }
              }
              
              resultElement.style.display = 'block';
            } catch (error) {
              log(\`Error: \${error.message}\`);
            }
          });
        </script>
      </body>
      </html>
    `);
  });
  
  // API endpoint to test Gemini image generation
  app.post("/api/test-gemini-image", async (req, res) => {
    try {
      const { prompt, model = "gemini-1.5-flash" } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt parameter" });
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable" });
      }
      
      console.log(`Testing image generation with model: ${model} and prompt: "${prompt}"`);
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({ model });
      
      try {
        // Ask Gemini to return an image or URL for the given prompt
        const result = await genModel.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: `I want an image of ${prompt}.
                Take an image from the internet if you can.
                If you can't, provide a detailed description of what that image would look like.` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,
          }
        });
        
        const response = await result.response;
        const responseText = response.text();
        
        console.log("Gemini test response:", responseText.substring(0, 200) + "...");
        
        // Return the raw response for debugging, plus check for any image URLs
        const urlMatch = responseText.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i);
        let imageUrl = null;
        
        if (urlMatch) {
          imageUrl = urlMatch[0];
          console.log("Found image URL in response:", imageUrl);
        }
        
        // Return both the raw response and any extracted URL
        return res.json({ 
          rawResponse: responseText,
          imageUrl: imageUrl
        });
        
      } catch (error: any) {
        console.error("Error using Gemini model:", error);
        return res.status(500).json({ 
          error: `Error using Gemini model: ${error.message || 'Unknown error'}`,
          details: error
        });
      }
    } catch (error) {
      console.error("Error in test-gemini-image route:", error);
      res.status(500).json({ error: "Failed to test image generation" });
    }
  });
  
  // New Gemini image generation test page
  app.get("/new-gemini-test", renderTestPage);
  
  // New API endpoint for Gemini image generation
  app.post("/api/new-gemini-image", testGeminiImageGeneration);
  
  // Simple API test for our new image generator
  app.post("/api/test-image", testImageGeneration);

  return httpServer;
}
