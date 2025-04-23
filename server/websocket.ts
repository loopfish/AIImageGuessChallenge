import { WebSocketServer, WebSocket } from "ws";
import { IStorage } from "./storage";
import {
  WebSocketMessage,
  CreateGameMessage,
  JoinGameMessage,
  StartGameMessage,
  SubmitGuessMessage,
  NextRoundMessage,
  GameMessageType,
  Game,
  Round,
  Player,
  GameState,
  Guess,
  InsertGuess,
  RoundResult,
} from "@shared/schema";
import { generateImage } from "./gemini";
import { 
  matchWords, 
  calculateGuessScore, 
  determineRoundWinners,
  generateGameCode
} from "@/lib/game-utils";

// Track connected clients and their associated player IDs
interface ConnectedClient {
  socket: WebSocket;
  playerId?: number;
  gameId?: number;
}

// Map of clientId to ConnectedClient
const clients = new Map<string, ConnectedClient>();

// Map of gameId to set of clientIds
const gameClients = new Map<number, Set<string>>();

// Map of games with active timers
const gameTimers = new Map<number, NodeJS.Timeout>();

// Use the reconnection types from the shared schema

export function setupWebsocketHandlers(wss: WebSocketServer, storage: IStorage) {
  console.log('WebSocket handler setup initialized');
  
  wss.on("connection", (socket: WebSocket, request) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substring(2, 15);
    console.log(`Client connected: ${clientId}, URL: ${request.url}`);
    console.log(`WebSocket connection state: ${socket.readyState}`);

    // Store the client connection
    clients.set(clientId, { socket });
    console.log(`Total connected clients: ${clients.size}`);
    console.log(`Game rooms: ${gameClients.size}`);
    
    // Send a welcome message to confirm connection is working
    try {
      const welcomeMessage = JSON.stringify({
        type: GameMessageType.GAME_STATE,
        payload: { message: "Welcome to the game server!" }
      });
      socket.send(welcomeMessage);
      console.log(`Sent welcome message to client ${clientId}`);
    } catch (error) {
      console.error(`Failed to send welcome message to client ${clientId}:`, error);
    }

    // Handle messages from clients
    socket.on("message", async (message: string) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(message);
        console.log(`Received message type: ${parsedMessage.type}`);
        
        // Debug special message types more verbosely
        if (parsedMessage.type === GameMessageType.NEXT_ROUND) {
          console.log(`NEXT_ROUND received from client ${clientId}:`, parsedMessage.payload);
        }

        switch (parsedMessage.type) {
          case GameMessageType.CREATE_GAME:
            await handleCreateGame(clientId, parsedMessage as CreateGameMessage, storage);
            break;
            
          case GameMessageType.JOIN_GAME:
            await handleJoinGame(clientId, parsedMessage as JoinGameMessage, storage);
            break;
            
          case GameMessageType.START_GAME:
            await handleStartGame(parsedMessage as StartGameMessage, storage);
            break;
            
          case GameMessageType.SUBMIT_GUESS:
            await handleSubmitGuess(parsedMessage as SubmitGuessMessage, storage);
            break;
            
          case GameMessageType.NEXT_ROUND:
            await handleNextRound(parsedMessage as NextRoundMessage, storage);
            break;
            
          case GameMessageType.END_GAME:
            await handleEndGame(parsedMessage.payload.gameId, storage);
            break;
            
          // Handle player reconnection request
          case GameMessageType.RECONNECT_REQUEST:
            await handlePlayerReconnect(clientId, parsedMessage.payload, storage);
            break;
        }
      } catch (error) {
        console.error("Error processing message:", error);
        sendErrorToClient(clientId, (error as Error).message);
      }
    });

    // Handle client disconnection
    socket.on("close", () => {
      const client = clients.get(clientId);
      if (client && client.gameId && client.playerId) {
        handlePlayerDisconnect(clientId, client.gameId, client.playerId, storage);
      }
      
      // Remove client from our maps
      clients.delete(clientId);
      console.log(`Client disconnected: ${clientId}`);
    });
  });
}

// Handler for creating a new game
async function handleCreateGame(
  clientId: string, 
  message: CreateGameMessage, 
  storage: IStorage
) {
  try {
    const { username, timerSeconds, totalRounds } = message.payload;
    
    // Create user if needed (or get existing)
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.createUser({ username, password: "placeholder" });
    }
    
    // Generate a unique game code
    const gameCode = generateGameCode();
    
    // Create the game
    const game = await storage.createGame({
      code: gameCode,
      hostId: user.id,
      status: "lobby",
      currentRound: 1,
      totalRounds,
      timerSeconds,
    });
    
    // Create player (the host)
    const player = await storage.createPlayer({
      gameId: game.id,
      userId: user.id,
      username: user.username,
      score: 0,
      isHost: true,
      isActive: true
    });
    
    // Update client with game and player IDs
    const client = clients.get(clientId);
    if (client) {
      client.gameId = game.id;
      client.playerId = player.id;
    }
    
    // Create gameClients entry
    const clientSet = new Set<string>();
    clientSet.add(clientId);
    gameClients.set(game.id, clientSet);
    
    // Send game state to client
    sendGameState(game.id, storage);
    
    console.log(`Game created: ${gameCode} by ${username}`);
  } catch (error) {
    console.error("Error creating game:", error);
    sendErrorToClient(clientId, "Failed to create game");
  }
}

// Handler for joining an existing game
async function handleJoinGame(
  clientId: string, 
  message: JoinGameMessage, 
  storage: IStorage
) {
  try {
    const { username, gameCode } = message.payload;
    
    // Find the game
    const game = await storage.getGameByCode(gameCode);
    if (!game) {
      return sendErrorToClient(clientId, "Game not found");
    }
    
    // Create user if needed (or get existing)
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.createUser({ username, password: "placeholder" });
    }
    
    // Check if user already in game
    const existingPlayer = await storage.getPlayerByGameAndUser(game.id, user.id);
    let player;
    
    if (existingPlayer) {
      // Update existing player to active
      player = await storage.updatePlayer(existingPlayer.id, { isActive: true });
    } else {
      // Create new player
      player = await storage.createPlayer({
        gameId: game.id,
        userId: user.id,
        username: user.username,
        score: 0,
        isHost: false,
        isActive: true
      });
    }
    
    // Update client with game and player IDs
    const client = clients.get(clientId);
    if (client) {
      client.gameId = game.id;
      client.playerId = player.id;
    }
    
    // Add client to game clients map
    let gameSet = gameClients.get(game.id);
    if (!gameSet) {
      gameSet = new Set<string>();
      gameClients.set(game.id, gameSet);
    }
    gameSet.add(clientId);
    
    // Send updated player list to all clients in the game
    const players = await storage.getPlayersByGameId(game.id);
    sendToGame(game.id, {
      type: GameMessageType.PLAYER_UPDATE,
      payload: { players }
    });
    
    // Send complete game state to the new client
    sendGameStateToClient(clientId, game.id, storage);
    
    console.log(`Player ${username} joined game ${gameCode}`);
  } catch (error) {
    console.error("Error joining game:", error);
    sendErrorToClient(clientId, "Failed to join game");
  }
}

// Handler for starting a game with first round
async function handleStartGame(message: StartGameMessage, storage: IStorage) {
  try {
    const { gameId, prompt } = message.payload;
    console.log(`Starting game ${gameId} with prompt: "${prompt}"`);
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found`);
      throw new Error("Game not found");
    }
    
    console.log(`Game found: ${game.code}, status: ${game.status}`);
    
    // Generate image from Gemini API
    const imageUrl = await generateImage(prompt);
    
    // Create first round
    const round = await storage.createRound({
      gameId,
      roundNumber: 1,
      prompt,
      imageUrl,
      status: "active"
    });
    
    // Update round with start time
    await storage.updateRound(round.id, { 
      startTime: new Date(),
      status: "active"
    });
    
    // Update game status
    await storage.updateGame(gameId, { 
      status: "playing",
      currentRound: 1 
    });
    
    // Get updated game and notify clients
    const updatedGame = await storage.getGame(gameId);
    if (updatedGame) {
      // Start the round timer
      startRoundTimer(gameId, updatedGame.timerSeconds, storage);
      
      // Notify clients that round has started
      sendToGame(gameId, {
        type: GameMessageType.ROUND_START,
        payload: {
          round,
          timeRemaining: updatedGame.timerSeconds
        }
      });
      
      // Send updated game state
      sendGameState(gameId, storage);
      
      console.log(`Game ${updatedGame.code} started with prompt: "${prompt}"`);
    }
  } catch (error) {
    console.error("Error starting game:", error);
    // Send error to all clients in the game
    sendErrorToGameClients(message.payload.gameId, "Failed to start game");
  }
}

// Handler for submitting a guess
async function handleSubmitGuess(message: SubmitGuessMessage, storage: IStorage) {
  try {
    const { gameId, playerId, roundId, guessText } = message.payload;
    
    // Get the round
    const round = await storage.getRound(roundId);
    if (!round || round.status !== "active") {
      throw new Error("Round not active");
    }
    
    // Get the player
    const player = await storage.getPlayer(playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    
    // Process the guess
    const prompt = round.prompt.toLowerCase();
    const guess = guessText.toLowerCase();
    
    // Find matched words
    const matchedWords = matchWords(prompt, guess);
    
    // Create guess entry
    const guessData: InsertGuess = {
      roundId,
      playerId,
      guessText: guess,
      matchedWords,
      matchCount: matchedWords.length
    };
    
    const newGuess = await storage.createGuess(guessData);
    
    // Notify all clients about the new guess
    const guessWithDetails = {
      ...newGuess,
      username: player.username,
      timestamp: new Date().toISOString()
    };
    
    sendToGame(gameId, {
      type: GameMessageType.PLAYER_GUESS,
      payload: guessWithDetails
    });
    
    console.log(`Player ${player.username} submitted guess with ${matchedWords.length} matches`);
  } catch (error) {
    console.error("Error submitting guess:", error);
    // Find client for this player
    const clientId = findClientIdByPlayerId(message.payload.playerId);
    if (clientId) {
      sendErrorToClient(clientId, "Failed to submit guess");
    }
  }
}

// Handler for advancing to the next round
async function handleNextRound(message: NextRoundMessage, storage: IStorage) {
  try {
    const { gameId, prompt } = message.payload;
    console.log(`Starting next round for game ${gameId} with prompt: "${prompt}"`);
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found for next round`);
      throw new Error("Game not found");
    }
    
    console.log(`Game found: ${game.code}, status: ${game.status}, current round ${game.currentRound}, total rounds ${game.totalRounds}`);
    
    // Check if we've reached max rounds
    if (game.currentRound >= game.totalRounds) {
      console.log(`Reached maximum rounds (${game.totalRounds}), ending game`);
      await handleEndGame(gameId, storage);
      return;
    }
    
    // Mark current round as completed
    const currentRound = await storage.getCurrentRound(gameId);
    if (currentRound) {
      console.log(`Found current round ${currentRound.id}, round number ${currentRound.roundNumber} for game ${game.code}`);
      await storage.updateRound(currentRound.id, {
        status: "completed",
        endTime: new Date()
      });
    } else {
      console.log(`No current round found for game ${game.code}`);
    }
    
    // Generate image from Gemini API
    console.log(`Generating image for prompt: "${prompt}"`);
    const imageUrl = await generateImage(prompt);
    console.log(`Generated image URL for prompt: "${prompt}"`);
    
    // Create new round
    const newRoundNumber = game.currentRound + 1;
    console.log(`Creating round ${newRoundNumber} for game ${game.code}`);
    const round = await storage.createRound({
      gameId,
      roundNumber: newRoundNumber,
      prompt,
      imageUrl,
      status: "active"
    });
    
    // Update round with start time
    console.log(`Setting start time for round ${round.id}`);
    await storage.updateRound(round.id, { 
      startTime: new Date(),
      status: "active"
    });
    
    // Update game status
    console.log(`Updating game ${gameId} to round ${newRoundNumber}`);
    await storage.updateGame(gameId, { 
      status: "playing",
      currentRound: newRoundNumber
    });
    
    // Get updated game and notify clients
    const updatedGame = await storage.getGame(gameId);
    if (updatedGame) {
      // Start the round timer
      console.log(`Starting timer for game ${game.code} with ${updatedGame.timerSeconds} seconds`);
      startRoundTimer(gameId, updatedGame.timerSeconds, storage);
      
      // Notify clients that round has started
      console.log(`Notifying clients that round ${round.roundNumber} has started`);
      sendToGame(gameId, {
        type: GameMessageType.ROUND_START,
        payload: {
          round,
          timeRemaining: updatedGame.timerSeconds
        }
      });
      
      // Send updated game state
      console.log(`Sending updated game state to all clients for game ${game.code}`);
      sendGameState(gameId, storage);
      
      console.log(`Game ${updatedGame.code} advanced to round ${updatedGame.currentRound}`);
    } else {
      console.error(`Failed to retrieve updated game after updating round`);
    }
  } catch (error) {
    console.error("Error starting next round:", error);
    // Send error to all clients in the game
    sendErrorToGameClients(message.payload.gameId, "Failed to start next round: " + (error as Error).message);
  }
}

// Handler for ending the entire game
async function handleEndGame(gameId: number, storage: IStorage) {
  try {
    // Update game status
    await storage.updateGame(gameId, { status: "finished" });
    
    // Clear any active timer
    clearRoundTimer(gameId);
    
    // Send game state to all clients
    sendGameState(gameId, storage);
    
    console.log(`Game ${gameId} has ended`);
  } catch (error) {
    console.error("Error ending game:", error);
  }
}

// Handler for when a player disconnects
async function handlePlayerDisconnect(
  clientId: string, 
  gameId: number, 
  playerId: number, 
  storage: IStorage
) {
  try {
    // Update player to inactive
    await storage.updatePlayer(playerId, { isActive: false });
    
    // Remove client from game clients map
    const gameSet = gameClients.get(gameId);
    if (gameSet) {
      gameSet.delete(clientId);
      if (gameSet.size === 0) {
        // If no more clients, remove game entry and cancel any timers
        gameClients.delete(gameId);
        clearRoundTimer(gameId);
      } else {
        // Otherwise update player list for remaining clients
        const players = await storage.getPlayersByGameId(gameId);
        sendToGame(gameId, {
          type: GameMessageType.PLAYER_UPDATE,
          payload: { players }
        });
      }
    }
    
    console.log(`Player ${playerId} disconnected from game ${gameId}`);
  } catch (error) {
    console.error("Error handling player disconnect:", error);
  }
}

// Function to end a round and calculate scores
async function endRound(gameId: number, storage: IStorage) {
  try {
    console.log(`Ending round for game ${gameId}`);
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found when ending round`);
      return;
    }
    
    if (game.status !== "playing") {
      console.log(`Game ${gameId} is not in 'playing' status, current status: ${game.status}`);
      return;
    }
    
    // Get the current round
    const round = await storage.getCurrentRound(gameId);
    if (!round) {
      console.error(`No current round found for game ${gameId}`);
      return;
    }
    
    console.log(`Found current round ${round.id}, round number ${round.roundNumber} for game ${game.code}`);
    
    // Update round status and end time
    await storage.updateRound(round.id, { 
      status: "completed",
      endTime: new Date()
    });
    
    // Update game status
    await storage.updateGame(gameId, { status: "round_end" });
    
    // Get all player guesses for this round
    const roundGuesses = await storage.getGuessesByRoundId(round.id);
    
    // Get all players
    const players = await storage.getPlayersByGameId(gameId);
    
    // Determine winners
    const { 
      firstPlace, 
      secondPlace, 
      thirdPlace 
    } = await determineRoundWinners(round, roundGuesses, players, storage);
    
    // Create round result
    const roundResult = await storage.createRoundResult({
      roundId: round.id,
      firstPlaceId: firstPlace?.id,
      secondPlaceId: secondPlace?.id,
      thirdPlaceId: thirdPlace?.id
    });
    
    // Update player scores
    if (firstPlace) {
      await storage.updatePlayer(firstPlace.id, { score: firstPlace.score + 3 });
    }
    
    if (secondPlace) {
      await storage.updatePlayer(secondPlace.id, { score: secondPlace.score + 2 });
    }
    
    if (thirdPlace) {
      await storage.updatePlayer(thirdPlace.id, { score: thirdPlace.score + 1 });
    }
    
    // Get updated players list with new scores
    const updatedPlayers = await storage.getPlayersByGameId(gameId);
    
    // Get first place matched words
    const firstPlaceGuess = firstPlace 
      ? roundGuesses.find(g => g.playerId === firstPlace.id) 
      : undefined;
      
    // Get second place matched words
    const secondPlaceGuess = secondPlace 
      ? roundGuesses.find(g => g.playerId === secondPlace.id) 
      : undefined;
      
    // Get third place matched words
    const thirdPlaceGuess = thirdPlace 
      ? roundGuesses.find(g => g.playerId === thirdPlace.id) 
      : undefined;
    
    // Send round end event with results
    sendToGame(gameId, {
      type: GameMessageType.ROUND_END,
      payload: {
        round,
        results: {
          ...roundResult,
          firstPlace: firstPlace && firstPlaceGuess ? {
            ...firstPlace,
            matchedWords: firstPlaceGuess.matchedWords || []
          } : undefined,
          secondPlace: secondPlace && secondPlaceGuess ? {
            ...secondPlace,
            matchedWords: secondPlaceGuess.matchedWords || []
          } : undefined,
          thirdPlace: thirdPlace && thirdPlaceGuess ? {
            ...thirdPlace,
            matchedWords: thirdPlaceGuess.matchedWords || []
          } : undefined
        },
        standings: updatedPlayers.sort((a, b) => b.score - a.score)
      }
    });
    
    // Update game state for all clients
    sendGameState(gameId, storage);
    
    console.log(`Round ${round.roundNumber} ended for game ${game.code}`);
  } catch (error) {
    console.error("Error ending round:", error);
  }
}

// Start a timer for the round
function startRoundTimer(gameId: number, seconds: number, storage: IStorage) {
  // Clear any existing timer
  clearRoundTimer(gameId);
  
  // Create interval to update clients on time remaining
  let timeRemaining = seconds;
  
  const timer = setInterval(async () => {
    timeRemaining--;
    
    // Send timer update
    sendToGame(gameId, {
      type: GameMessageType.TIMER_UPDATE,
      payload: { timeRemaining }
    });
    
    // End the round when timer reaches zero
    if (timeRemaining <= 0) {
      clearRoundTimer(gameId);
      await endRound(gameId, storage);
    }
  }, 1000);
  
  gameTimers.set(gameId, timer);
}

// Clear the round timer
function clearRoundTimer(gameId: number) {
  const timer = gameTimers.get(gameId);
  if (timer) {
    clearInterval(timer);
    gameTimers.delete(gameId);
  }
}

// Send a full game state update to all clients in a game
async function sendGameState(gameId: number, storage: IStorage) {
  try {
    // Get game data
    const game = await storage.getGame(gameId);
    if (!game) return;
    
    // Get players
    const players = await storage.getPlayersByGameId(gameId);
    
    // Build game state
    const gameState: GameState = {
      game,
      players
    };
    
    // Add current round data if game is active
    if (game.status !== "lobby") {
      const currentRound = await storage.getCurrentRound(gameId);
      gameState.currentRound = currentRound;
      
      if (currentRound) {
        // Add player guesses for the round
        const guesses = await storage.getGuessesByRoundId(currentRound.id);
        gameState.playerGuesses = guesses;
        
        // Add round results if available
        const roundResults = await storage.getRoundResultByRoundId(currentRound.id);
        gameState.roundResults = roundResults;
      }
    }
    
    // Send game state update to all clients
    sendToGame(gameId, {
      type: GameMessageType.GAME_STATE,
      payload: gameState
    });
  } catch (error) {
    console.error("Error sending game state:", error);
  }
}

// Send game state to a specific client
async function sendGameStateToClient(clientId: string, gameId: number, storage: IStorage) {
  try {
    // Get game data
    const game = await storage.getGame(gameId);
    if (!game) return;
    
    // Get players
    const players = await storage.getPlayersByGameId(gameId);
    
    // Build game state
    const gameState: GameState = {
      game,
      players
    };
    
    // Add current round data if game is active
    if (game.status !== "lobby") {
      const currentRound = await storage.getCurrentRound(gameId);
      gameState.currentRound = currentRound;
      
      if (currentRound) {
        // Add player guesses for the round
        const guesses = await storage.getGuessesByRoundId(currentRound.id);
        gameState.playerGuesses = guesses;
        
        // Add round results if available
        const roundResults = await storage.getRoundResultByRoundId(currentRound.id);
        gameState.roundResults = roundResults;
      }
    }
    
    // Send game state update to the specific client
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify({
        type: GameMessageType.GAME_STATE,
        payload: gameState
      }));
    }
  } catch (error) {
    console.error("Error sending game state to client:", error);
  }
}

// Send message to all clients in a game
function sendToGame(gameId: number, message: WebSocketMessage) {
  const gameSet = gameClients.get(gameId);
  if (!gameSet) return;
  
  const messageString = JSON.stringify(message);
  
  // Convert Set to Array before iterating
  Array.from(gameSet).forEach(clientId => {
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(messageString);
    }
  });
}

// Send error message to a specific client
function sendErrorToClient(clientId: string, errorMessage: string) {
  const client = clients.get(clientId);
  if (client && client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify({
      type: GameMessageType.GAME_ERROR,
      payload: { message: errorMessage }
    }));
  }
}

// Send error to all clients in a game
function sendErrorToGameClients(gameId: number, errorMessage: string) {
  sendToGame(gameId, {
    type: GameMessageType.GAME_ERROR,
    payload: { message: errorMessage }
  });
}

// Handle player reconnection request
async function handlePlayerReconnect(clientId: string, payload: any, storage: IStorage) {
  try {
    const { playerId, gameId } = payload;
    console.log(`Reconnection request from client ${clientId} for player ${playerId} in game ${gameId}`);
    
    if (!playerId || !gameId) {
      console.error("Invalid reconnection request - missing playerId or gameId");
      return sendErrorToClient(clientId, "Invalid reconnection request. Missing player or game ID.");
    }
    
    // Verify the player exists
    const player = await storage.getPlayer(playerId);
    if (!player) {
      console.error(`Player ${playerId} not found during reconnection attempt`);
      return sendErrorToClient(clientId, "Player not found. Please rejoin the game.");
    }
    
    // Verify the game exists
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found during reconnection attempt`);
      return sendErrorToClient(clientId, "Game not found. Please create a new game.");
    }
    
    console.log(`Reconnecting player ${player.username} (${playerId}) to game ${game.code} (${gameId})`);
    
    // Update player to active if needed
    if (!player.isActive) {
      await storage.updatePlayer(playerId, { isActive: true });
    }
    
    // Store client association with game and player
    const client = clients.get(clientId);
    if (client) {
      client.gameId = gameId;
      client.playerId = playerId;
    }
    
    // Add client to game clients map
    let gameSet = gameClients.get(gameId);
    if (!gameSet) {
      gameSet = new Set<string>();
      gameClients.set(gameId, gameSet);
    }
    gameSet.add(clientId);
    
    // Send success response
    const reconnectedClient = clients.get(clientId);
    if (reconnectedClient && reconnectedClient.socket.readyState === WebSocket.OPEN) {
      reconnectedClient.socket.send(JSON.stringify({
        type: GameMessageType.RECONNECT_SUCCESS,
        payload: { 
          message: "Reconnection successful",
          playerId,
          gameId
        }
      }));
    }
    
    // Send complete game state to the reconnected client
    sendGameStateToClient(clientId, gameId, storage);
    
    console.log(`Player ${player.username} successfully reconnected to game ${game.code}`);
  } catch (error) {
    console.error("Error handling player reconnect:", error);
    sendErrorToClient(clientId, "Failed to reconnect. Please try joining again.");
    
    // Send failure response
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify({
        type: GameMessageType.RECONNECT_FAILURE,
        payload: { 
          message: "Reconnection failed",
          error: (error as Error).message
        }
      }));
    }
  }
}

// Find clientId by playerId
function findClientIdByPlayerId(playerId: number): string | undefined {
  // Convert Map.entries() to Array before iterating
  const clientEntries = Array.from(clients.entries());
  for (const [clientId, client] of clientEntries) {
    if (client.playerId === playerId) {
      return clientId;
    }
  }
  return undefined;
}
