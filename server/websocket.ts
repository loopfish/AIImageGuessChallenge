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
  HeartbeatMessage,
  HeartbeatResponseMessage,
  PlayersOnlineUpdateMessage,
} from "@shared/schema";
import { generateImage } from "./gemini-image";
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
  sessionId?: string;     // Unique browser session identifier
  connectionTime?: number; // Timestamp of connection
  lastActive?: number;     // Timestamp of last activity
}

// Map of clientId to ConnectedClient
const clients = new Map<string, ConnectedClient>();

// Map of gameId to set of clientIds
const gameClients = new Map<number, Set<string>>();

// Map of games with active timers
const gameTimers = new Map<number, NodeJS.Timeout>();

// Map of gameId to set of online playerIds
const onlinePlayers = new Map<number, Set<number>>();

// Heartbeat interval (in milliseconds)
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

// Use the reconnection types from the shared schema

// Track server restart state
let serverRestartInProgress = false;

/**
 * Broadcast server restart message to all connected clients
 */
function broadcastServerRestart() {
  console.log("Broadcasting server restart message to all connected clients...");
  serverRestartInProgress = true;
  
  // Broadcast to all clients
  const restartMessage: WebSocketMessage = {
    type: GameMessageType.SERVER_RESTART,
    payload: { message: "Server is restarting. You will be redirected to the home page." }
  };
  
  clients.forEach((client, clientId) => {
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(restartMessage));
        console.log(`Sent restart message to client ${clientId}`);
      } catch (error) {
        console.error(`Failed to send restart message to client ${clientId}:`, error);
      }
    }
  });
}

// Export the broadcast function to global scope so it can be called from outside this module
(global as any).broadcastServerRestart = broadcastServerRestart;

export function setupWebsocketHandlers(wss: WebSocketServer, storage: IStorage) {
  console.log('WebSocket handler setup initialized');
  
  wss.on("connection", (socket: WebSocket, request) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substring(2, 15);
    console.log(`Client connected: ${clientId}, URL: ${request.url}`);
    console.log(`WebSocket connection state: ${socket.readyState}`);

    // Store the client connection with activity timestamps
    clients.set(clientId, { 
      socket,
      connectionTime: Date.now(),
      lastActive: Date.now(),
      // sessionId will be set when reconnection/heartbeat messages come in
    });
    console.log(`Total connected clients: ${clients.size}`);
    console.log(`Game rooms: ${gameClients.size}`);
    
    // Send a simple welcome message to confirm connection is working
    // But don't use game state type to avoid confusion
    try {
      const welcomeMessage = JSON.stringify({
        type: GameMessageType.WELCOME,
        payload: { message: "Connected to game server" }
      });
      socket.send(welcomeMessage);
      console.log(`Sent welcome message to client ${clientId}`);
    } catch (error) {
      console.error(`Failed to send welcome message to client ${clientId}:`, error);
    }

    // Handle messages from clients
    socket.on("message", async (message: string) => {
      try {
        // Update last active timestamp
        const client = clients.get(clientId);
        if (client) {
          client.lastActive = Date.now();
        }
        
        const parsedMessage: WebSocketMessage = JSON.parse(message);
        
        // Add clientId to message payload for better player tracking
        if (!parsedMessage.clientId) {
          parsedMessage.clientId = clientId;
        }
        
        // Extract sessionId from payload if present and update client record
        if (client && parsedMessage.payload && typeof parsedMessage.payload === 'object') {
          // If sessionId is in the payload, store it with the client
          if ('sessionId' in parsedMessage.payload && 
              parsedMessage.payload.sessionId && 
              typeof parsedMessage.payload.sessionId === 'string') {
            const sessionId = parsedMessage.payload.sessionId;
            client.sessionId = sessionId;
            console.log(`Updated sessionId for client ${clientId}: ${sessionId}`);
          }
        }
        
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
            
          case GameMessageType.DELETE_GAME:
            await handleDeleteGame(parsedMessage.payload.gameId, parsedMessage.payload.sessionId, clientId, storage);
            break;
            
          // Handle player reconnection request
          case GameMessageType.RECONNECT_REQUEST:
            await handlePlayerReconnect(clientId, parsedMessage.payload, storage);
            break;

          // Handle heartbeat from client
          case GameMessageType.HEARTBEAT:
            handleHeartbeat(clientId, parsedMessage as HeartbeatMessage);
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
        // Don't immediately mark player as inactive, keep them in the game
        // They might be refreshing or accidentally closed the tab
        console.log(`Client ${clientId} disconnected but keeping player active in game ${client.gameId}`);
        
        // We'll still remove the client from the active clients map
        // but we won't mark the player as inactive in the database
        
        // After 60 seconds, if they haven't reconnected, then mark as inactive
        setTimeout(async () => {
          try {
            // Check if this player is still disconnected
            // For sessionId-enabled clients, require both playerId AND sessionId to match
            // This allows multiple tabs/windows from same device to be distinct players
            const isReconnected = Array.from(clients.values()).some(c => {
              // If we have sessionId, use it for exact matching
              if (client.sessionId && c.sessionId) {
                return c.playerId === client.playerId && 
                       c.gameId === client.gameId && 
                       c.sessionId === client.sessionId;
              } 
              // Fallback to just playerId and gameId matching for backward compatibility
              return c.playerId === client.playerId && c.gameId === client.gameId;
            });
            
            // If they haven't reconnected, then mark as inactive
            if (!isReconnected && client.gameId && client.playerId) {
              console.log(`Player ${client.playerId} did not reconnect after 60s, marking inactive`);
              await handlePlayerDisconnect(clientId, client.gameId, client.playerId, storage);
            }
          } catch (error) {
            console.error("Error in delayed player disconnect handler:", error);
          }
        }, 60000); // 60 second grace period
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
    const { username, timerSeconds, totalRounds, roomName, roomPassword, sessionId } = message.payload;
    
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
      roomName: roomName || null,
      roomPassword: roomPassword || null,
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
      client.sessionId = sessionId; // Store sessionId for browser tab identification
      client.connectionTime = Date.now();
      client.lastActive = Date.now();
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
    const { username, gameCode, password, sessionId } = message.payload;
    
    // Find the game
    const game = await storage.getGameByCode(gameCode);
    if (!game) {
      return sendErrorToClient(clientId, "Game not found");
    }
    
    // Check if game requires a password
    if (game.roomPassword && (!password || password !== game.roomPassword)) {
      return sendErrorToClient(clientId, "Incorrect password");
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
      client.sessionId = sessionId; // Store sessionId for browser tab identification
      client.connectionTime = Date.now();
      client.lastActive = Date.now();
      
      // Add player to online players set for this game
      let onlinePlayersForGame = onlinePlayers.get(game.id);
      if (!onlinePlayersForGame) {
        onlinePlayersForGame = new Set<number>();
        onlinePlayers.set(game.id, onlinePlayersForGame);
      }
      onlinePlayersForGame.add(player.id);
    }
    
    // Add client to game clients map
    let gameSet = gameClients.get(game.id);
    if (!gameSet) {
      gameSet = new Set<string>();
      gameClients.set(game.id, gameSet);
    }
    gameSet.add(clientId);
    
    // Important: Send player joined confirmation message first to set current player ID
    const joiningClient = clients.get(clientId);
    if (joiningClient && joiningClient.socket.readyState === WebSocket.OPEN) {
      joiningClient.socket.send(JSON.stringify({
        type: GameMessageType.PLAYER_JOINED,
        payload: { 
          success: true,
          playerId: player.id,
          gameId: game.id,
          gameCode
        }
      }));
    }
    
    // Wait a short time to ensure client processes the player_joined message
    // before updating player list to avoid race conditions
    setTimeout(async () => {
      try {
        // Send updated player list to all clients in the game
        const updatedPlayers = await storage.getPlayersByGameId(game.id);
        
        console.log(`Sending updated player list to game ${gameCode} with ${updatedPlayers.length} players`);
        
        // First update players list 
        sendToGame(game.id, {
          type: GameMessageType.PLAYER_UPDATE,
          payload: { players: updatedPlayers }
        });
        
        // Broadcast online players status
        updateOnlinePlayersStatus(game.id);
        
        // Wait another moment before sending full game state
        setTimeout(async () => {
          // Send complete game state to all clients to ensure consistency
          sendGameState(game.id, storage);
          
          // Send individualized game state to new player to ensure they have latest data
          sendGameStateToClient(clientId, game.id, storage);
        }, 300);
      } catch (error) {
        console.error("Error sending delayed player updates:", error);
      }
    }, 500); // Increased delay to ensure client has time to set current player ID
    
    console.log(`Player ${username} joined game ${gameCode}`);
  } catch (error) {
    console.error("Error joining game:", error);
    sendErrorToClient(clientId, "Failed to join game");
  }
}

// Utility function to validate host permissions with sessionId support
async function validateHostPermission(gameId: number, sessionId: string | undefined, clientId: string | undefined, storage: IStorage): Promise<boolean> {
  try {
    // Get the game 
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found during host validation`);
      return false;
    }
    
    // If we have a clientId, that's most reliable for finding the player
    if (clientId && clients.has(clientId)) {
      const client = clients.get(clientId);
      if (client && client.playerId) {
        const player = await storage.getPlayer(client.playerId);
        if (player && player.isHost) {
          // Verify sessionId matches if both are provided
          if (sessionId && client.sessionId && sessionId !== client.sessionId) {
            console.error(`SessionId mismatch during host validation: ${sessionId} vs ${client.sessionId}`);
            return false;
          }
          console.log(`Host validated via client ID: ${player.username} (ID: ${player.id})`);
          return true;
        }
      }
    }
    
    // If we have a sessionId, find clients with this sessionId in this game
    if (sessionId) {
      const matchingClients = Array.from(clients.entries())
        .filter(([_, client]) => 
          client.sessionId === sessionId && 
          client.gameId === gameId
        );
      
      if (matchingClients.length > 0) {
        // Check if any of these clients has a player that is host
        for (const [_, client] of matchingClients) {
          if (client.playerId) {
            const player = await storage.getPlayer(client.playerId);
            if (player && player.isHost) {
              console.log(`Host validated via sessionId: ${player.username} (ID: ${player.id})`);
              return true;
            }
          }
        }
      }
    }
    
    // If all direct checks failed, get all players and validate host by game hostId
    if (game.hostId) {
      // Check all connected clients for this game to find the host
      const gameClientIds = gameClients.get(gameId);
      if (gameClientIds) {
        for (const cId of gameClientIds) {
          const client = clients.get(cId);
          if (client && client.playerId) {
            const player = await storage.getPlayer(client.playerId);
            if (player && player.userId === game.hostId) {
              console.log(`Host validated via game hostId: ${player.username} (ID: ${player.id})`);
              return true;
            }
          }
        }
      }
    }

    console.error(`Host validation failed for game ${gameId}, session ${sessionId}`);
    return false;
  } catch (error) {
    console.error("Error validating host permission:", error);
    return false;
  }
}

// Handler for starting a game with first round
async function handleStartGame(message: StartGameMessage, storage: IStorage) {
  try {
    const { gameId, prompt, imageUrl: existingImageUrl, sessionId } = message.payload;
    
    // Verify that the request comes from the host using sessionId
    const isHost = await validateHostPermission(gameId, sessionId, message.clientId, storage);
    if (!isHost) {
      console.error(`Non-host attempt to start game ${gameId} with session ${sessionId}`);
      throw new Error("Only the host can start the game");
    }
    console.log(`Starting game ${gameId} with prompt: "${prompt}"`);
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found`);
      throw new Error("Game not found");
    }
    
    console.log(`Game found: ${game.code}, status: ${game.status}`);
    
    // Use the existing image URL if provided, otherwise generate a new one
    let imageUrl;
    if (existingImageUrl) {
      console.log(`Using existing image URL for prompt: "${prompt}"`);
      imageUrl = existingImageUrl;
    } else {
      console.log(`Generating image for prompt: "${prompt}"`);
      imageUrl = await generateImage(prompt);
    }
    
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
    const { gameId, playerId, roundId, guessText, username, gameCode, sessionId } = message.payload;
    // Get the clientId from the message object - should have been set during message parsing
    const socketClientId = message.clientId;
    
    // Log incoming request with clientId for tracing
    console.log(`Processing guess from client ${socketClientId} in game ${gameId}, round ${roundId}: "${guessText}"`);
    
    // Get the round
    const round = await storage.getRound(roundId);
    if (!round || round.status !== "active") {
      throw new Error("Round not active");
    }
    
    // Get all possible players for this game
    const allPlayers = await storage.getPlayersByGameId(gameId);
    if (!allPlayers || allPlayers.length === 0) {
      throw new Error(`No players found for game ${gameId}`);
    }
    
    // IMPROVED PLAYER IDENTIFICATION:
    // 1. First try to use the socket's clientId (most reliable)
    let player = null;
    
    // If we have a clientId from the socket connection itself
    if (socketClientId && clients.has(socketClientId)) {
      const client = clients.get(socketClientId);
      if (client && client.playerId) {
        // Find this player in our game
        const clientPlayer = allPlayers.find(p => p.id === client.playerId);
        if (clientPlayer) {
          player = clientPlayer;
          console.log(`Using socket client-mapped player: ${player.username} (ID: ${player.id}), Socket ClientID: ${socketClientId}`);
        }
      }
    }
    
    // 1.5 If sessionId was provided, try to find clients with matching sessionId and game
    if (!player && sessionId) {
      const clientsWithMatchingSession = Array.from(clients.entries())
        .filter(([_, client]) => 
          client.sessionId === sessionId && 
          client.gameId === gameId
        );
        
      if (clientsWithMatchingSession.length > 0) {
        // Use the first client with matching session ID
        const [_, client] = clientsWithMatchingSession[0];
        if (client.playerId) {
          const sessionPlayer = allPlayers.find(p => p.id === client.playerId);
          if (sessionPlayer) {
            player = sessionPlayer;
            console.log(`Found player by sessionId: ${player.username} (ID: ${player.id}), SessionID: ${sessionId}`);
          }
        }
      }
    }
    
    // 2. If username was provided in the message, use it to find the player (second most reliable)
    if (!player && username) {
      // Case-insensitive username matching
      player = allPlayers.find(p => 
        p.username.toLowerCase() === username.toLowerCase()
      );
      if (player) {
        console.log(`Found player by username: ${player.username} (ID: ${player.id})`);
      }
    }
    
    // 3. Try the playerId from the message directly (less reliable)
    if (!player) {
      player = allPlayers.find(p => p.id === playerId);
      if (player) {
        console.log(`Using message-provided player: ${player.username} (ID: ${player.id})`);
      }
    }
    
    // 4. Last resort: look through all clients for this game to find a valid player
    if (!player) {
      console.log(`Player not found directly. Attempting to find correct player through connected clients...`);
      
      // Lookup all clients in this game
      const gameClients = Array.from(clients.entries())
        .filter(([_, client]) => client.gameId === gameId);
      
      // Debug info
      console.log(`Found ${gameClients.length} clients connected to game ${gameId}`);
      
      for (const [connClientId, client] of gameClients) {
        if (client.playerId) {
          console.log(`Client ${connClientId} is mapped to player ${client.playerId} in game ${gameId}`);
          const possiblePlayer = allPlayers.find(p => p.id === client.playerId);
          if (possiblePlayer) {
            player = possiblePlayer;
            console.log(`Using connected client's player: ${player.username} (ID: ${player.id})`);
            break;
          }
        }
      }
    }
    
    // Never default to the host - if we can't determine the player, fail
    if (!player) {
      console.error(`Player identification failed for guess. Socket ClientID: ${socketClientId}, Game: ${gameId}`);
      throw new Error(`Could not determine which player submitted this guess`);
    }
    
    // Verify this player is in the correct game
    if (player.gameId !== gameId) {
      console.error(`Player ${player.id} (${player.username}) belongs to game ${player.gameId}, not ${gameId}`);
      throw new Error("Player not in this game");
    }
    
    // Check if player has already submitted a guess for this round
    const existingGuesses = await storage.getGuessesByRoundAndPlayer(roundId, player.id);
    
    if (existingGuesses && existingGuesses.length > 0) {
      console.log(`Player ${player.username} already submitted a guess for round ${roundId}`);
      
      // If player has a client ID, send them a specific error
      if (socketClientId) {
        sendErrorToClient(socketClientId, "You've already submitted a guess for this round");
      }
      
      return; // Exit early, not creating a new guess
    }
    
    // Process the guess
    const prompt = round.prompt.toLowerCase();
    const guess = guessText.toLowerCase();
    
    // Find matched words
    const matchedWords = matchWords(prompt, guess);
    
    // Create guess entry with the CORRECT player ID (not the one from the message)
    const guessData: InsertGuess = {
      roundId,
      playerId: player.id, // Use the corrected player ID
      guessText: guess,
      matchedWords,
      matchCount: matchedWords.length
    };
    
    console.log(`Creating guess for player ${player.username} (ID: ${player.id}) in round ${roundId}`);
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
    // Find client for this player, including the session ID for more precise targeting
    const clientId = findClientIdByPlayerId(message.payload.playerId, message.payload.sessionId);
    if (clientId) {
      sendErrorToClient(clientId, "Failed to submit guess");
    }
  }
}

// Handler for advancing to the next round
async function handleNextRound(message: NextRoundMessage, storage: IStorage) {
  try {
    const { gameId, prompt, sessionId } = message.payload;
    
    // Verify that the request comes from the host using sessionId
    const isHost = await validateHostPermission(gameId, sessionId, message.clientId, storage);
    if (!isHost) {
      console.error(`Non-host attempt to advance round in game ${gameId} with session ${sessionId}`);
      throw new Error("Only the host can advance to the next round");
    }
    
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
    
    // Send a game_reset message to all clients to redirect them to the home page
    sendToGame(gameId, {
      type: GameMessageType.GAME_RESET,
      payload: { message: "Game has ended. Returning to home page." }
    });
    
    console.log(`Game ${gameId} has ended, sent reset message to all clients`);
  } catch (error) {
    console.error("Error ending game:", error);
  }
}

// Handler for delete game request
async function handleDeleteGame(
  gameId: number, 
  sessionId: string | undefined, 
  clientId: string,
  storage: IStorage
) {
  try {
    console.log(`Received delete game request for game ${gameId} from client ${clientId}`);
    
    // Validate if the requester is the host
    const isHost = await validateHostPermission(gameId, sessionId, clientId, storage);
    if (!isHost) {
      console.error(`Client ${clientId} attempted to delete game ${gameId} but is not the host`);
      return sendErrorToClient(clientId, "Only the host can delete a game");
    }
    
    // Get the game to delete
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found for deletion`);
      return sendErrorToClient(clientId, "Game not found");
    }
    
    // Notify all connected clients that the game is being deleted
    sendToGame(gameId, {
      type: GameMessageType.DELETE_GAME,
      payload: { 
        message: "Game has been deleted by the host. You'll be redirected to the home page." 
      }
    });
    
    console.log(`Deleting game ${gameId} (${game.code})`);
    
    // Delete the game from storage
    const deleteResult = await storage.deleteGame(gameId);
    
    // Clean up game clients and online players
    if (gameClients.has(gameId)) {
      gameClients.delete(gameId);
    }
    
    if (onlinePlayers.has(gameId)) {
      onlinePlayers.delete(gameId);
    }
    
    console.log(`Game ${gameId} (${game.code}) ${deleteResult ? 'successfully deleted' : 'delete failed'}`);
  } catch (error) {
    console.error(`Error deleting game: ${error}`);
    sendErrorToClient(clientId, "Failed to delete game");
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
    
    // Remove player from online players list
    const onlinePlayersForGame = onlinePlayers.get(gameId);
    if (onlinePlayersForGame) {
      onlinePlayersForGame.delete(playerId);
      
      // If there are no more online players for this game, clean up
      if (onlinePlayersForGame.size === 0) {
        onlinePlayers.delete(gameId);
      }
      
      // Broadcast updated online players status
      updateOnlinePlayersStatus(gameId);
    }
    
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
    
    // Build game state with online players information
    const gameState: GameState = {
      game,
      players,
      onlinePlayers: Array.from(onlinePlayers.get(gameId) || [])
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
    
    // Build game state with online players information
    const gameState: GameState = {
      game,
      players,
      onlinePlayers: Array.from(onlinePlayers.get(gameId) || [])
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
    console.log(`Reconnection request from client ${clientId} with payload:`, payload);
    
    // Check for different reconnection methods (game code, game ID, or player ID)
    let gameId = payload.gameId;
    let playerId = payload.playerId;
    const gameCode = payload.gameCode;
    const username = payload.username;
    const sessionId = payload.sessionId;
    const wasHost = payload.wasHost === true;
    const hostSessionId = payload.hostSessionId;
    
    // Log to make debugging easier
    console.log(`Reconnection data: gameId=${gameId}, playerId=${playerId}, gameCode=${gameCode}, username=${username}, sessionId=${sessionId}, wasHost=${wasHost}, hostSessionId=${hostSessionId}`);
    
    // Prioritize game code for reconnection as it's most reliable across devices
    if (gameCode) {
      console.log(`Looking up game by code: ${gameCode}`);
      const game = await storage.getGameByCode(gameCode);
      if (game) {
        gameId = game.id;
        console.log(`Found game ${gameId} for code ${gameCode}, status: ${game.status}`);
        
        // If game is ended or complete, tell client so they can show appropriate UI
        if (game.status === "ended" || game.status === "completed") {
          console.log(`Game ${gameCode} is already ${game.status}`);
          return sendErrorToClient(clientId, `Game with code ${gameCode} has already ended.`);
        }
      } else {
        console.error(`Game with code ${gameCode} not found`);
        return sendErrorToClient(clientId, `Game with code ${gameCode} not found. Please create a new game.`);
      }
    }
    
    // If we have a playerId but no gameId, look up the player's game
    if (!gameId && playerId) {
      // Get player first to find their game
      const player = await storage.getPlayer(playerId);
      if (player) {
        gameId = player.gameId;
        console.log(`Found game ${gameId} for player ${playerId}`);
      }
    }
    
    // At this point we need a gameId
    if (!gameId) {
      console.error("Invalid reconnection request - can't determine game");
      return sendErrorToClient(clientId, "Invalid reconnection request. Cannot determine which game to reconnect to.");
    }
    
    // Verify the game exists
    const game = await storage.getGame(gameId);
    if (!game) {
      console.error(`Game ${gameId} not found during reconnection attempt`);
      return sendErrorToClient(clientId, "Game not found. Please create a new game.");
    }
    
    // Now try to find or create a player for this client
    let player = null;
    
    // First attempt: use the provided player ID if valid
    if (playerId) {
      console.log(`Looking for player with ID ${playerId} in game ${gameId} (${game.code})`);
      
      // Get all players for the game to debug
      const allPlayers = await storage.getPlayersByGameId(gameId);
      console.log(`Players in game ${game.code}:`);
      allPlayers.forEach(p => {
        console.log(`  - Player ID=${p.id}, Username=${p.username}, isActive=${p.isActive}`);
      });
      
      // Try to find specific player
      player = await storage.getPlayer(playerId);
      
      if (player) {
        // Verify this player belongs to the game we found
        if (player.gameId !== gameId) {
          console.error(`Player ${playerId} (${player.username}) belongs to game ${player.gameId}, not ${gameId}`);
          
          // Special case for Jenny (ID 12)
          if (player.username === 'Jenny') {
            console.log(`Found Jenny but in wrong game. Checking if Jenny exists in game ${gameId}...`);
            
            // Try to find Jenny in this game
            const jennyInThisGame = allPlayers.find(p => p.username === 'Jenny');
            if (jennyInThisGame) {
              console.log(`Found Jenny (ID=${jennyInThisGame.id}) in game ${gameId}. Using this player.`);
              player = jennyInThisGame;
              playerId = jennyInThisGame.id;
            } else {
              player = null; // Reset so we can try other methods
            }
          } else {
            player = null; // Reset so we can try other methods
          }
        } else {
          console.log(`Found player ${player.username} (${playerId}) for game ${game.code}`);
        }
      } else {
        console.log(`Player ID ${playerId} not found, checking for player in this specific game`);
        
        // Try to find this player ID specifically in this game
        const playerInGame = allPlayers.find(p => p.id === playerId);
        if (playerInGame) {
          console.log(`Found player ${playerInGame.username} (ID=${playerId}) in game ${game.code}`);
          player = playerInGame;
        } else {
          console.log(`Player ID ${playerId} not found in this game, will try username`);
        }
      }
    }
    
    // Second attempt: use the username to find an existing player in this game
    if (!player && username) {
      const players = await storage.getPlayersByGameId(gameId);
      console.log(`Found ${players.length} players in game ${game.code}`);
      
      const existingPlayer = players.find(p => p.username.toLowerCase() === username.toLowerCase());
      if (existingPlayer) {
        player = existingPlayer;
        playerId = existingPlayer.id;
        console.log(`Found existing player ${existingPlayer.username} (${existingPlayer.id}) for reconnection`);
      } else {
        console.log(`No player found with username ${username} in game ${game.code}`);
      }
    }
    
    // Third attempt: create a new player if we have a username
    if (!player && username) {
      // Create a new user or get existing one
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({ username, password: "placeholder" });
      }
      
      // Create a new player in the game
      const newPlayer = await storage.createPlayer({
        gameId,
        userId: user.id,
        username: user.username,
        score: 0,
        isHost: false,
        isActive: true
      });
      
      player = newPlayer;
      playerId = newPlayer.id;
      console.log(`Created new player ${newPlayer.username} (${newPlayer.id}) for game ${game.code}`);
    }
    
    // If we still have no player, we can't proceed
    if (!player) {
      console.error(`No valid player found for reconnection to game ${game.code}`);
      return sendErrorToClient(clientId, "Could not determine player. Please provide a username.");
    }
    
    console.log(`Reconnecting player ${player.username} (${playerId}) to game ${game.code} (${gameId})`);
    
    // Check if we need to restore host status
    if (wasHost && hostSessionId && sessionId === hostSessionId) {
      console.log(`Restoring host status for player ${player.username} (${playerId}) in game ${game.code}`);
      // Check if another player is already host
      const players = await storage.getPlayersByGameId(gameId);
      const existingHost = players.find(p => p.isHost && p.id !== playerId);
      
      if (existingHost) {
        console.log(`Game ${game.code} already has a host: ${existingHost.username} (${existingHost.id}). Not changing host status.`);
      } else if (player.userId === game.hostId) {
        // Only restore host status if this player was the original host (check userId against game.hostId)
        console.log(`Restoring host status for player ${player.username} (${playerId}) in game ${game.code}`);
        await storage.updatePlayer(playerId, { isActive: true, isHost: true });
        // Update player object to reflect the change
        player.isHost = true;
      } else {
        console.log(`Not restoring host status for player ${player.username} - not the original host (userId=${player.userId}, hostId=${game.hostId})`);
        await storage.updatePlayer(playerId, { isActive: true });
      }
    } else {
      // Regular update - just mark active
      await storage.updatePlayer(playerId, { isActive: true });
    }
    
    // Store client association with game and player
    const client = clients.get(clientId);
    if (client) {
      client.gameId = gameId;
      client.playerId = playerId;
      client.sessionId = sessionId;
      client.connectionTime = Date.now();
      client.lastActive = Date.now();
      
      // Add player to online players set for this game
      let onlinePlayersForGame = onlinePlayers.get(gameId);
      if (!onlinePlayersForGame) {
        onlinePlayersForGame = new Set<number>();
        onlinePlayers.set(gameId, onlinePlayersForGame);
      }
      onlinePlayersForGame.add(playerId);
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
          gameId,
          gameCode: game.code,
          sessionId: sessionId, // Return the sessionId back to client for confirmation
          isHost: player.isHost  // Include host status information
        }
      }));
    }
    
    // Send updated player list to all clients in the game
    const players = await storage.getPlayersByGameId(game.id);
    sendToGame(game.id, {
      type: GameMessageType.PLAYER_UPDATE,
      payload: { players }
    });
    
    // Update online players status
    const onlinePlayersForGame = onlinePlayers.get(gameId);
    console.log(`DEBUG - Online players for game ${gameId} before update:`, 
                onlinePlayersForGame ? Array.from(onlinePlayersForGame) : []);
                
    updateOnlinePlayersStatus(gameId);
    
    // Log online players again after update
    console.log(`DEBUG - Online players for game ${gameId} after update:`, 
                onlinePlayersForGame ? Array.from(onlinePlayersForGame) : []);
    
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

// Find clientId by playerId and optionally sessionId
function findClientIdByPlayerId(playerId: number, sessionId?: string): string | undefined {
  // Convert Map.entries() to Array before iterating
  const clientEntries = Array.from(clients.entries());
  
  // If sessionId is provided, do a more precise match
  if (sessionId) {
    for (const [clientId, client] of clientEntries) {
      if (client.playerId === playerId && client.sessionId === sessionId) {
        return clientId;
      }
    }
  }
  
  // Fallback to just matching by playerId (for backward compatibility)
  for (const [clientId, client] of clientEntries) {
    if (client.playerId === playerId) {
      return clientId;
    }
  }
  
  return undefined;
}

// Handle heartbeat messages from clients
function handleHeartbeat(clientId: string, message: HeartbeatMessage) {
  const { playerId, gameId, timestamp, sessionId } = message.payload;
  const client = clients.get(clientId);
  
  if (!client) {
    console.log(`Received heartbeat for unknown client ${clientId}`);
    return;
  }
  
  // Update client's lastActive timestamp
  client.lastActive = Date.now();
  
  // Update client's player and game IDs if they're not set
  if (!client.playerId) client.playerId = playerId;
  if (!client.gameId) client.gameId = gameId;
  if (sessionId) client.sessionId = sessionId; // Store the sessionId
  
  // Add player to online players for this game
  let onlinePlayersForGame = onlinePlayers.get(gameId);
  if (!onlinePlayersForGame) {
    onlinePlayersForGame = new Set<number>();
    onlinePlayers.set(gameId, onlinePlayersForGame);
  }
  onlinePlayersForGame.add(playerId);
  
  // Respond to heartbeat
  try {
    const response: HeartbeatResponseMessage = {
      type: GameMessageType.HEARTBEAT_RESPONSE,
      payload: {
        acknowledged: true,
        timestamp: Date.now()
      }
    };
    
    client.socket.send(JSON.stringify(response));
    
    // Update all clients with the current online players
    updateOnlinePlayersStatus(gameId);
  } catch (error) {
    console.error(`Error sending heartbeat response to client ${clientId}:`, error);
  }
}

// Update all clients about which players are currently online
function updateOnlinePlayersStatus(gameId: number) {
  const onlinePlayersForGame = onlinePlayers.get(gameId);
  
  if (!onlinePlayersForGame) return;
  
  const message: PlayersOnlineUpdateMessage = {
    type: GameMessageType.PLAYERS_ONLINE_UPDATE,
    payload: {
      gameId,
      onlinePlayers: Array.from(onlinePlayersForGame)
    }
  };
  
  sendToGame(gameId, message);
}
