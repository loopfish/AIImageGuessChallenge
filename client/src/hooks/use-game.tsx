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
      
      switch (message.type) {
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
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }, [getCurrentPlayerFromStorage, saveCurrentPlayerToStorage]);
  
  // Attempt reconnection with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (isReconnecting.current) return;
    
    if (reconnectAttempts.current >= 5) {
      console.log("Max reconnection attempts reached");
      return;
    }
    
    isReconnecting.current = true;
    reconnectAttempts.current++;
    
    const backoffTime = Math.min(1000 * (2 ** reconnectAttempts.current), 10000);
    console.log(`Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts.current})`);
    
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    
    reconnectTimer.current = setTimeout(() => {
      console.log(`Attempting reconnection #${reconnectAttempts.current}`);
      connectWebSocket().finally(() => {
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
              console.log(`Sending reconnection request for player ${playerId}`);
              socket.send(JSON.stringify({
                type: GameMessageType.RECONNECT_REQUEST,
                payload: { playerId }
              }));
            }
          }
          
          resolve(socket);
        };
        
        socket.onmessage = handleWebSocketMessage;
        
        socket.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          setIsConnected(false);
          socketRef.current = null;
          
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
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Game not found: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Process player info
          let currentPlayerId = null;
          if (data.players && data.players.length > 0) {
            const savedPlayerId = getCurrentPlayerFromStorage();
            
            // First check if the saved player ID is valid for this game
            if (savedPlayerId) {
              const existingPlayer = data.players.find(p => p.id === savedPlayerId);
              if (existingPlayer) {
                currentPlayerId = existingPlayer.id;
              }
            }
            
            // If no valid saved player ID, use the first player
            if (!currentPlayerId) {
              currentPlayerId = data.players[0].id;
              saveCurrentPlayerToStorage(currentPlayerId);
            }
          }
          
          // Update game state
          setGameState({
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
