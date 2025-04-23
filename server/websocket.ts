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

export function setupWebsocketHandlers(wss: WebSocketServer, storage: IStorage) {
  wss.on("connection", (socket: WebSocket) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substring(2, 15);
    console.log(`Client connected: ${clientId}`);

    // Store the client connection
    clients.set(clientId, { socket });

    // Handle messages from clients
    socket.on("message", async (message: string) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(message);
        console.log(`Received message type: ${parsedMessage.type}`);

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
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    
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
    
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    
    // Check if we've reached max rounds
    if (game.currentRound >= game.totalRounds) {
      await handleEndGame(gameId, storage);
      return;
    }
    
    // Generate image from Gemini API
    const imageUrl = await generateImage(prompt);
    
    // Create new round
    const round = await storage.createRound({
      gameId,
      roundNumber: game.currentRound + 1,
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
      currentRound: game.currentRound + 1 
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
      
      console.log(`Game ${updatedGame.code} advanced to round ${updatedGame.currentRound}`);
    }
  } catch (error) {
    console.error("Error starting next round:", error);
    // Send error to all clients in the game
    sendErrorToGameClients(message.payload.gameId, "Failed to start next round");
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
    // Get the game
    const game = await storage.getGame(gameId);
    if (!game || game.status !== "playing") {
      return;
    }
    
    // Get the current round
    const round = await storage.getCurrentRound(gameId);
    if (!round) {
      return;
    }
    
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
  
  for (const clientId of gameSet) {
    const client = clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(messageString);
    }
  }
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

// Find clientId by playerId
function findClientIdByPlayerId(playerId: number): string | undefined {
  for (const [clientId, client] of clients.entries()) {
    if (client.playerId === playerId) {
      return clientId;
    }
  }
  return undefined;
}
