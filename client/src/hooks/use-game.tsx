import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from "react";
import { useWebSocket } from "./use-websocket";
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
  const [location] = useLocation();
  
  // Get URL info for game code - using useMemo to prevent recreation on every render
  const gameCode = useMemo(() => {
    const urlParts = location.split('/');
    return urlParts[urlParts.length - 1];
  }, [location]);
  
  // Store current player ID in localStorage to survive reconnections
  const saveCurrentPlayerToStorage = useCallback((playerId: number) => {
    try {
      localStorage.setItem('currentPlayerId', playerId.toString());
      console.log(`Saved current player ID to storage: ${playerId}`);
    } catch (error) {
      console.error("Error saving player ID to storage:", error);
    }
  }, []);

  // Get current player ID from localStorage
  const getCurrentPlayerFromStorage = useCallback((): number | null => {
    try {
      const savedId = localStorage.getItem('currentPlayerId');
      if (savedId) {
        const playerId = parseInt(savedId, 10);
        console.log(`Retrieved player ID from storage: ${playerId}`);
        return playerId;
      }
    } catch (error) {
      console.error("Error retrieving player ID from storage:", error);
    }
    return null;
  }, []);
  
  // Define WebSocket message handler
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket message received:", message.type, message.payload);
      
      switch (message.type) {
        case GameMessageType.GAME_STATE:
          const gameStateData = message.payload as GameState;
          
          // Add current player ID to game state
          if (gameStateData?.players && gameStateData.players.length > 0) {
            console.log("Players in game state:", gameStateData.players);
            
            // Try to find current player from localStorage first
            const savedPlayerId = getCurrentPlayerFromStorage();
            let currentPlayer = null;
            
            if (savedPlayerId) {
              // Find player in the game state players list
              currentPlayer = gameStateData.players.find((p: any) => p.id === savedPlayerId);
              console.log(`Looking for saved player ID ${savedPlayerId}, found:`, currentPlayer);
            }
            
            // If no player found with saved ID, default to first player
            if (!currentPlayer) {
              currentPlayer = gameStateData.players[0];
              console.log("No matching saved player, defaulting to first player:", currentPlayer);
              
              // Save this player ID for future reconnects
              if (currentPlayer) {
                saveCurrentPlayerToStorage(currentPlayer.id);
              }
            }
            
            if (currentPlayer) {
              console.log("Selected current player:", currentPlayer);
              gameStateData.currentPlayerId = currentPlayer.id;
            } else {
              console.warn("No current player could be identified");
            }
          } else {
            console.warn("No players found in game state");
          }
          
          setGameState(gameStateData);
          setLoading(false);
          break;
          
        case GameMessageType.PLAYER_UPDATE:
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              players: message.payload.players
            };
          });
          break;
          
        case GameMessageType.ROUND_START:
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentRound: message.payload.round,
              timeRemaining: message.payload.timeRemaining,
              game: {
                ...prev.game,
                status: "playing"
              } 
            };
          });
          break;
          
        case GameMessageType.ROUND_END:
          console.log("Round end message received:", message.payload);
          setGameState(prev => {
            if (!prev) {
              console.warn("No previous game state when handling ROUND_END");
              return prev;
            }
            
            const updatedState = {
              ...prev,
              currentRound: message.payload.round,
              roundResults: message.payload.results,
              players: message.payload.standings,
              game: {
                ...prev.game,
                status: "round_end"
              }
            };
            
            console.log("Updated game state after round end:", updatedState);
            return updatedState;
          });
          break;
          
        case GameMessageType.PLAYER_GUESS:
          setGameState(prev => {
            if (!prev) return prev;
            
            // Add new guess to playerGuesses
            const updatedGuesses = [
              ...(prev.playerGuesses || []),
              message.payload
            ];
            
            return {
              ...prev,
              playerGuesses: updatedGuesses
            };
          });
          break;
          
        case GameMessageType.TIMER_UPDATE:
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              timeRemaining: message.payload.timeRemaining
            };
          });
          break;
          
        case GameMessageType.GAME_ERROR:
          setError(message.payload.message);
          break;
          
        case GameMessageType.RECONNECT_SUCCESS:
          console.log("Reconnection successful:", message.payload);
          // We don't need to do more here as the server will send a game state update next
          break;
          
        case GameMessageType.RECONNECT_FAILURE:
          console.error("Reconnection failed:", message.payload);
          setError(`Failed to reconnect: ${message.payload.message}`);
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }, [getCurrentPlayerFromStorage, saveCurrentPlayerToStorage]);
  
  // Track whether we should attempt reconnection
  const shouldAttemptReconnect = useRef(false);
  
  // Store the reconnection info for use after socket is available
  const pendingReconnectInfo = useRef<{playerId: number, gameId: number} | null>(null);
  
  // Handle WebSocket connection open event
  const handleWebSocketOpen = useCallback((event: Event) => {
    // Only attempt to restore game state if needed
    if (shouldAttemptReconnect.current) {
      const playerId = getCurrentPlayerFromStorage();
      
      // Get gameId from localStorage to avoid dependency on gameState
      let gameId: number | null = null;
      try {
        const storedGameId = localStorage.getItem('currentGameId');
        if (storedGameId) {
          gameId = parseInt(storedGameId, 10);
        } else if (gameState?.game?.id) {
          // Fall back to game state if available
          gameId = gameState.game.id;
          // Save for future reconnects
          localStorage.setItem('currentGameId', gameId.toString());
        }
      } catch (err) {
        console.error("Error reading game ID from storage:", err);
      }
      
      if (playerId && gameId) {
        console.log(`Storing reconnection info for player ${playerId} to game ${gameId}`);
        pendingReconnectInfo.current = { playerId, gameId };
        shouldAttemptReconnect.current = false;
      }
    }
  }, [getCurrentPlayerFromStorage, gameState]);

  // Setup WebSocket connection with the memoized handler
  const { 
    socket, 
    isConnected, 
    connect,
    error: wsError 
  } = useWebSocket({
    autoConnect: false,
    onMessage: handleWebSocketMessage,
    onOpen: handleWebSocketOpen,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
    onClose: () => {
      console.log("WebSocket closed, setting reconnect flag");
      shouldAttemptReconnect.current = true;
    },
    onError: () => {
      console.log("WebSocket error, setting reconnect flag");
      shouldAttemptReconnect.current = true;
    }
  });
  
  // We're using the useCallback version of handleWebSocketMessage above
  
  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    try {
      // If we're already connected, return the existing socket
      if (socket && socket.readyState === WebSocket.OPEN) {
        return socket;
      }
      
      setLoading(true);
      setError(null);
      
      // Connect to the WebSocket server using host which includes the port
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // Includes hostname and port
      const wsUrl = `${protocol}//${host}/ws`;
      console.log("Connecting to WebSocket at:", wsUrl);
      
      const newSocket = await connect(wsUrl);
      return newSocket;
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      setError("Failed to connect to game server");
      setLoading(false);
      throw error;
    }
  }, [connect, socket]);
  
  // Set websocket error
  useEffect(() => {
    if (wsError) {
      setError(wsError.message);
    }
  }, [wsError]);
  
  // Handle reconnection once socket is available
  useEffect(() => {
    if (isConnected && socket && pendingReconnectInfo.current) {
      const { playerId, gameId } = pendingReconnectInfo.current;
      console.log(`Sending reconnection request for player ${playerId} to game ${gameId}`);
      
      socket.send(JSON.stringify({
        type: GameMessageType.RECONNECT_REQUEST,
        payload: { playerId, gameId }
      }));
      
      // Clear the pending reconnect info after sending
      pendingReconnectInfo.current = null;
    }
  }, [isConnected, socket]);
  
  // If on game page, fetch initial game state when connected
  useEffect(() => {
    // Only execute if we have a socket connection and we're on a game page
    if (isConnected && socket && location.startsWith('/game/')) {
      // Extract gameCode from URL, only make the API call on specific game pages
      if (gameCode && gameCode !== 'lobby') {
        setLoading(true);
        
        // Fetch game data if already in a specific game
        const apiUrl = `/api/games/${gameCode}/state`;
        console.log("Fetching game state from API:", apiUrl);
        
        fetch(apiUrl)
          .then(res => {
            console.log("API response status:", res.status);
            if (!res.ok) {
              throw new Error(`Game not found: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            console.log("Received game state data:", data);
            
            // Set game data
            if (data) {
              // Try to find current player from localStorage first
              const savedPlayerId = getCurrentPlayerFromStorage();
              let currentPlayerId;
              
              if (savedPlayerId && data.players) {
                // Find player in the game state players list
                const existingPlayer = data.players.find((p: any) => p.id === savedPlayerId);
                if (existingPlayer) {
                  currentPlayerId = existingPlayer.id;
                  console.log(`Found player with saved ID ${savedPlayerId}:`, existingPlayer);
                } else {
                  console.log(`Player with saved ID ${savedPlayerId} not found in game`);
                }
              }
              
              // If no saved player or not found, default to first player
              if (!currentPlayerId && data.players && data.players.length > 0) {
                currentPlayerId = data.players[0]?.id;
                console.log(`Defaulting to first player with ID ${currentPlayerId}`);
                
                // Save this player ID for future reconnects
                if (currentPlayerId) {
                  saveCurrentPlayerToStorage(currentPlayerId);
                }
              }
              
              const gameStateWithPlayer = {
                ...data,
                currentPlayerId
              };
              console.log("Setting game state with player ID:", gameStateWithPlayer);
              setGameState(gameStateWithPlayer);
            } else {
              console.warn("Received empty game state data");
            }
            setLoading(false);
          })
          .catch(err => {
            console.error("Error fetching game:", err);
            setError(err.message);
            setLoading(false);
          });
      }
    } else if (location === '/') {
      // On home page, not in a game
      setLoading(false);
    }
  }, [isConnected, socket, location, gameCode, saveCurrentPlayerToStorage, getCurrentPlayerFromStorage]);
  
  const value = {
    gameState,
    loading,
    error,
    socket,
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
