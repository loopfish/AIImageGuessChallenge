import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from "react";
import { GameState, WebSocketMessage, GameMessageType } from "@shared/schema";
import { useLocation } from "wouter";

interface GameContextType {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
  socket: WebSocket | null;
  isConnected: boolean;
  connectWebSocket: () => Promise<WebSocket>;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [location] = useLocation();
  
  // Store/track WebSocket instance using a ref to avoid re-renders
  const socketRef = useRef<WebSocket | null>(null);
  
  // Track if first fetch has been done
  const hasFetchedRef = useRef(false);
  
  // Track reconnection attempts
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isReconnecting = useRef(false);
  
  // Track heartbeat timing
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatTime = useRef<number>(0);
  
  // Extract game code from URL
  const gameCode = useMemo(() => {
    const urlParts = location.split('/');
    return urlParts[urlParts.length - 1];
  }, [location]);
  
  // Local storage helpers
  const saveCurrentPlayerToStorage = useCallback((playerId: number) => {
    try {
      localStorage.setItem('currentPlayerId', playerId.toString());
      console.log(`Saved player ID: ${playerId}`);
    } catch (error) {
      console.error("Error saving to storage:", error);
    }
  }, []);

  const getCurrentPlayerFromStorage = useCallback((): number | null => {
    try {
      const savedId = localStorage.getItem('currentPlayerId');
      if (savedId) {
        return parseInt(savedId, 10);
      }
    } catch (error) {
      console.error("Error reading from storage:", error);
    }
    return null;
  }, []);
  
  // WebSocket message handler
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket message received:", message.type);
      
      // Debug log for game state messages
      if (message.type === GameMessageType.GAME_STATE) {
        console.log("Full game state message:", message.payload);
      }
      
      // Handle different message types
      switch (message.type) {
        // Handle welcome message from server
        case GameMessageType.WELCOME:
          console.log("Connected to server:", message.payload.message);
          // No state changes needed for the welcome message
          break;
          
        case GameMessageType.GAME_STATE:
          const gameData = message.payload as GameState;
          
          // Add current player ID if players exist
          if (gameData?.players?.length > 0) {
            const savedPlayerId = getCurrentPlayerFromStorage();
            let currentPlayer = savedPlayerId ? 
              gameData.players.find(p => p.id === savedPlayerId) : null;
            
            if (!currentPlayer) {
              currentPlayer = gameData.players[0];
              if (currentPlayer) saveCurrentPlayerToStorage(currentPlayer.id);
            }
            
            if (currentPlayer) {
              gameData.currentPlayerId = currentPlayer.id;
            }
          }
          
          setGameState(gameData);
          setLoading(false);
          break;
          
        case GameMessageType.PLAYER_UPDATE:
          setGameState(prev => {
            if (!prev) return prev;
            return { ...prev, players: message.payload.players };
          });
          break;
          
        case GameMessageType.ROUND_START:
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentRound: message.payload.round,
              timeRemaining: message.payload.timeRemaining,
              game: { ...prev.game, status: "playing" }
            };
          });
          break;
          
        case GameMessageType.ROUND_END:
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentRound: message.payload.round,
              roundResults: message.payload.results,
              players: message.payload.standings,
              game: { ...prev.game, status: "round_end" }
            };
          });
          break;
          
        case GameMessageType.PLAYER_GUESS:
          setGameState(prev => {
            if (!prev) return prev;
            const updatedGuesses = [...(prev.playerGuesses || []), message.payload];
            return { ...prev, playerGuesses: updatedGuesses };
          });
          break;
          
        case GameMessageType.TIMER_UPDATE:
          setGameState(prev => {
            if (!prev) return prev;
            return { ...prev, timeRemaining: message.payload.timeRemaining };
          });
          break;
          
        case GameMessageType.GAME_ERROR:
          setError(message.payload.message);
          break;
          
        case GameMessageType.RECONNECT_SUCCESS:
          console.log("Reconnected successfully");
          break;
          
        case GameMessageType.RECONNECT_FAILURE:
          setError(`Reconnection failed: ${message.payload.message}`);
          break;
          
        case GameMessageType.PLAYER_JOINED:
          // Handle specific player joined response
          console.log("Player joined response:", message.payload);
          // Save the player ID in local storage
          if (message.payload.success && message.payload.playerId) {
            saveCurrentPlayerToStorage(message.payload.playerId);
            
            // Update the current player ID in the game state
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                currentPlayerId: message.payload.playerId
              };
            });
          }
          break;
          
        case GameMessageType.HEARTBEAT_RESPONSE:
          // Update last heartbeat response time
          lastHeartbeatTime.current = message.payload.timestamp;
          break;
          
        case GameMessageType.PLAYERS_ONLINE_UPDATE:
          // Update online players list
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              onlinePlayers: message.payload.onlinePlayers
            };
          });
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }, [getCurrentPlayerFromStorage, saveCurrentPlayerToStorage]);
  
  // Attempt reconnection with exponential backoff
  // Enhanced reconnection logic 
  const attemptReconnect = useCallback(() => {
    if (isReconnecting.current) return;
    
    if (reconnectAttempts.current >= 10) { // Increased max attempts from 5 to 10
      console.log("Max reconnection attempts reached");
      setError("Connection lost. Please reload the page.");
      return;
    }
    
    isReconnecting.current = true;
    reconnectAttempts.current++;
    
    // Store game code for reconnection
    let currentGameCode = null;
    if (gameState?.game?.code) {
      currentGameCode = gameState.game.code;
      // Save to localStorage as a backup
      try {
        localStorage.setItem('lastGameCode', currentGameCode);
        console.log(`Saved game code for reconnection: ${currentGameCode}`);
      } catch (err) {
        console.error("Error saving game code:", err);
      }
    } else {
      // Try to get from localStorage
      try {
        currentGameCode = localStorage.getItem('lastGameCode');
        if (currentGameCode) {
          console.log(`Retrieved stored game code: ${currentGameCode}`);
        }
      } catch (err) {
        console.error("Error retrieving game code:", err);
      }
    }
    
    const backoffTime = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 10000);
    console.log(`Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts.current})`);
    
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    
    reconnectTimer.current = setTimeout(() => {
      console.log(`Attempting reconnection #${reconnectAttempts.current}`);
      connectWebSocket()
        .then(socket => {
          console.log("Reconnected successfully!");
          // Reset attempts on success
          reconnectAttempts.current = 0;
          
          // If we have a game code, send a reconnect message
          if (currentGameCode) {
            console.log(`Rejoining game: ${currentGameCode}`);
            
            // Wait a moment for the connection to stabilize
            setTimeout(() => {
              if (socket.readyState === WebSocket.OPEN) {
                try {
                  const reconnectMsg = {
                    type: GameMessageType.RECONNECT_REQUEST,
                    payload: {
                      gameCode: currentGameCode,
                      playerId: getCurrentPlayerFromStorage()
                    }
                  };
                  socket.send(JSON.stringify(reconnectMsg));
                } catch (err) {
                  console.error("Error sending reconnect message:", err);
                }
              }
            }, 500);
          }
        })
        .catch(err => {
          console.error("Reconnection failed:", err);
          // Try again if we haven't reached max attempts
          if (reconnectAttempts.current < 10) {
            attemptReconnect();
          }
        })
        .finally(() => {
          isReconnecting.current = false;
        });
    }, backoffTime);
  }, []);
  
  // WebSocket connection function
  const connectWebSocket = useCallback(async (): Promise<WebSocket> => {
    // If already connected, return the existing socket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return socketRef.current;
    }
    
    // Close any existing socket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setLoading(true);
    setError(null);
    
    return new Promise<WebSocket>((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log("Connecting to WebSocket at:", wsUrl);
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        socket.onopen = (event) => {
          console.log("WebSocket connected!");
          setIsConnected(true);
          reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
          
          // When in a game, send initial reconnection request
          if (location.startsWith('/game/') && gameCode && gameCode !== 'lobby') {
            const playerId = getCurrentPlayerFromStorage();
            if (playerId) {
              console.log(`Sending reconnection request for player ${playerId} in game ${gameCode}`);
              socket.send(JSON.stringify({
                type: GameMessageType.RECONNECT_REQUEST,
                payload: { 
                  playerId,
                  gameCode // Always include the game code for proper game matching
                }
              }));
            }
          }
          
          resolve(socket);
        };
        
        socket.onmessage = handleWebSocketMessage;
        
        socket.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          setIsConnected(false);
          
          // Don't set socketRef to null, just mark it as closed
          // We'll keep the reference for reconnection
          // socketRef.current = null;
          
          // Preserve the game state during reconnection
          console.log("Preserving game state during reconnection");
          
          if (!event.wasClean) {
            console.log("Connection was not closed cleanly, attempting to reconnect");
            attemptReconnect();
          }
        };
        
        socket.onerror = (event) => {
          console.error("WebSocket error:", event);
          setError("Connection error");
          reject(new Error("WebSocket connection error"));
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setError("Failed to connect");
        reject(error);
      }
    });
  }, [location, gameCode, handleWebSocketMessage, getCurrentPlayerFromStorage, attemptReconnect]);
  
  // Auto-connect on mount (just once)
  useEffect(() => {
    const connect = async () => {
      try {
        await connectWebSocket();
      } catch (err) {
        console.error("Initial connection failed:", err);
      }
    };
    
    connect();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
    };
  }, []);
  
  // Fetch game data when on a game page and connected
  useEffect(() => {
    // Only run once when we're connected and on a game page that's not the lobby
    const shouldFetchData = 
      isConnected && 
      location.startsWith('/game/') && 
      gameCode && 
      gameCode !== 'lobby' && 
      !hasFetchedRef.current;
      
    if (shouldFetchData) {
      hasFetchedRef.current = true;
      console.log(`Fetching game data for code: ${gameCode}`);
      
      const fetchGameData = async () => {
        try {
          setLoading(true);
          
          const apiUrl = `/api/games/${gameCode}/state`;
          console.log(`Fetching from API URL: ${apiUrl}`);
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Game not found: ${response.status}`);
          }
          
          const data = await response.json();
          console.log("Game data from API:", data);
          
          // Process player info
          let currentPlayerId = null;
          if (data.players && data.players.length > 0) {
            const savedPlayerId = getCurrentPlayerFromStorage();
            console.log("Saved player ID:", savedPlayerId, "Players:", data.players);
            
            // First check if the saved player ID is valid for this game
            if (savedPlayerId) {
              const existingPlayer = data.players.find((p: any) => p.id === savedPlayerId);
              if (existingPlayer) {
                currentPlayerId = existingPlayer.id;
                console.log("Found matching player in game:", existingPlayer);
              }
            }
            
            // If no valid saved player ID, use the first player
            if (!currentPlayerId) {
              currentPlayerId = data.players[0].id;
              saveCurrentPlayerToStorage(currentPlayerId);
              console.log("Using first player as current player:", currentPlayerId);
            }
          }
          
          // If this is an error message rather than a game
          if (!data.game) {
            console.error("Invalid game data received:", data);
            throw new Error("Invalid game data received");
          }
          
          // Update game state
          setGameState({
            ...data,
            currentPlayerId
          });
          
          console.log("Game state updated:", {
            ...data,
            currentPlayerId
          });
        } catch (err) {
          console.error("Error fetching game data:", err);
          setError(err instanceof Error ? err.message : "Failed to load game");
        } finally {
          setLoading(false);
        }
      };
      
      fetchGameData();
    }
  }, [isConnected, location, gameCode, getCurrentPlayerFromStorage, saveCurrentPlayerToStorage]);
  
  // Reset fetch flag on location change
  useEffect(() => {
    if (location === '/' || (location.startsWith('/game/') && gameCode === 'lobby')) {
      hasFetchedRef.current = false;
    }
  }, [location, gameCode]);
  
  // Heartbeat mechanism to maintain connection and update online status
  useEffect(() => {
    // Only send heartbeats when connected and in a game
    if (!isConnected || !socketRef.current || !gameState?.game?.id || !gameState.currentPlayerId) {
      return;
    }
    
    const sendHeartbeat = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          const heartbeatMessage = {
            type: GameMessageType.HEARTBEAT,
            payload: {
              playerId: gameState.currentPlayerId,
              gameId: gameState.game.id,
              timestamp: Date.now()
            }
          };
          
          socketRef.current.send(JSON.stringify(heartbeatMessage));
          console.log("Heartbeat sent", heartbeatMessage.payload);
        } catch (error) {
          console.error("Error sending heartbeat:", error);
        }
      }
    };
    
    // Send an immediate heartbeat
    sendHeartbeat();
    
    // Setup interval for regular heartbeats (every 15 seconds)
    const interval = setInterval(sendHeartbeat, 15000);
    heartbeatTimer.current = interval;
    
    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
    };
  }, [isConnected, gameState?.game?.id, gameState?.currentPlayerId]);
  
  // Prevent unnecessary WebSocket reconnections
  useEffect(() => {
    // This will stabilize the connection once we have game data
    if (gameState?.game && socketRef.current && isConnected) {
      console.log("Stable connection established with game data");
      
      // Create a reference to the current socket to avoid TypeScript errors
      const socket = socketRef.current;
      
      // Add a more robust error handler to the socket
      const existingOnError = socket.onerror;
      socket.onerror = (event) => {
        console.error("WebSocket error in stable connection:", event);
        if (existingOnError && typeof existingOnError === 'function') {
          // Direct call without .call to avoid TS errors
          existingOnError(event);
        }
      };
      
      // Override the close handler to prevent auto-disconnect
      const existingOnClose = socket.onclose;
      socket.onclose = (event) => {
        console.warn("WebSocket closed in stable connection:", event);
        // Only attempt reconnect if it wasn't a clean closure
        if (!event.wasClean) {
          attemptReconnect();
        }
        if (existingOnClose && typeof existingOnClose === 'function') {
          // Direct call without .call to avoid TS errors
          existingOnClose(event);
        }
      };
    }
  }, [gameState?.game, isConnected, attemptReconnect]);
  
  // Create context value
  const value: GameContextType = {
    gameState,
    loading,
    error,
    socket: socketRef.current,
    isConnected,
    connectWebSocket,
    setGameState
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
};
