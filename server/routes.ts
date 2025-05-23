import express, { type Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { setupWebsocketHandlers } from "./websocket";

// Extend global with broadcastServerRestart
declare global {
  var broadcastServerRestart: () => void;
}
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
  
  // Serve static files from the client/public directory for favicons and manifest
  app.use(express.static(path.join(import.meta.dirname, "..", "client", "public")));
  
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
  
  // Call the server restart function after a brief delay to allow WebSocket connections to establish
  setTimeout(() => {
    try {
      console.log("Broadcasting server restart notification to all clients...");
      if (global.broadcastServerRestart) {
        global.broadcastServerRestart();
      } else {
        console.warn("broadcastServerRestart function not found in global scope");
      }
    } catch (error) {
      console.error("Error broadcasting server restart:", error);
    }
  }, 5000);

  // API routes
  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok" });
  });
  
  // Add an admin API route to force reset all clients
  app.post("/api/admin/reset-clients", async (_req, res) => {
    try {
      // Reset all active games in the database
      await storage.resetAllActiveGames();
      
      // Broadcast server restart message to all connected clients
      if (global.broadcastServerRestart) {
        global.broadcastServerRestart();
        res.json({ status: "success", message: "Reset notification sent to all clients" });
      } else {
        res.status(500).json({ 
          status: "error", 
          message: "Failed to send reset notification - broadcastServerRestart not available" 
        });
      }
    } catch (error) {
      console.error("Error in reset-clients API:", error);
      res.status(500).json({ status: "error", message: String(error) });
    }
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
    res.send(renderFixedTestPage());
  });

  // Get list of active games
  app.get("/api/games", async (req, res) => {
    try {
      // Get all games in "lobby" status
      const games = await storage.getActiveGames();
      
      // Filter out sensitive info
      const filteredGames = games.map(game => ({
        id: game.id,
        code: game.code,
        status: game.status,
        roomName: game.roomName,
        hasPassword: Boolean(game.roomPassword),
        currentRound: game.currentRound,
        totalRounds: game.totalRounds,
        timerSeconds: game.timerSeconds,
        createdAt: game.createdAt
      }));
      
      res.json(filteredGames);
    } catch (error) {
      console.error("Error fetching active games:", error);
      res.status(500).json({ message: "Failed to fetch active games" });
    }
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
  
  // API endpoint to test server restart functionality
  app.post("/api/admin/restart", async (req, res) => {
    try {
      console.log("Server restart requested from admin endpoint");
      
      // Check authorization (for testing purposes)
      const authKey = req.query.key;
      if (authKey !== "devtest") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Send restart response first
      res.json({ message: "Server restart initiated" });
      
      // Wait 1 second to allow response to be sent
      setTimeout(() => {
        console.log("Initiating graceful server restart...");
        
        // Broadcast restart message if the function exists
        if (typeof (global as any).broadcastServerRestart === 'function') {
          console.log('Broadcasting server restart message to clients...');
          (global as any).broadcastServerRestart();
        }
        
        // Reset all active games
        storage.resetAllActiveGames()
          .then(() => {
            console.log('All games have been reset');
            console.log('Server restart test completed');
          })
          .catch(err => {
            console.error('Error resetting games:', err);
          });
      }, 1000);
    } catch (error) {
      console.error("Error initiating server restart:", error);
      res.status(500).json({ message: "Failed to initiate server restart" });
    }
  });

  return httpServer;
}
