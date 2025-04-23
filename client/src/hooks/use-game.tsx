import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
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
            
            // Try to find current player, we'll just use first player for now
            // This is a simplification - in a real app we'd match based on stored user ID
            const currentPlayer = gameStateData.players[0]; // Fallback to first player
            
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
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }, []);
  
  // Setup WebSocket connection with the memoized handler
  const { 
    socket, 
    isConnected, 
    connect,
    error: wsError 
  } = useWebSocket({
    autoConnect: false,
    onMessage: handleWebSocketMessage,
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
              const gameStateWithPlayer = {
                ...data,
                currentPlayerId: data.players[0]?.id // Temporary, will be updated by WebSocket
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
  }, [isConnected, socket, location, gameCode]);
  
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
