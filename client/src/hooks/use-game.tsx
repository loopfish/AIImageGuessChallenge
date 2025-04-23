import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
  const [location, navigate] = useLocation();
  
  // Get URL info for game code
  const urlParts = location.split('/');
  const gameCode = urlParts[urlParts.length - 1];
  
  // Setup WebSocket connection
  const { 
    socket, 
    isConnected, 
    connect,
    error: wsError 
  } = useWebSocket({
    autoConnect: false,
    onMessage: handleWebSocketMessage,
  });
  
  // Handle incoming WebSocket messages
  function handleWebSocketMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket message received:", message.type);
      
      switch (message.type) {
        case GameMessageType.GAME_STATE:
          const gameStateData = message.payload as GameState;
          
          // Add current player ID to game state
          if (gameStateData?.players && gameStateData.players.length > 0) {
            // Find player with same socket ID
            const currentPlayer = gameStateData.players[0]; // Fallback to first player
            if (currentPlayer) {
              gameStateData.currentPlayerId = currentPlayer.id;
            }
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
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentRound: message.payload.round,
              roundResults: message.payload.results,
              players: message.payload.standings,
              game: {
                ...prev.game,
                status: "round_end"
              }
            };
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
  }
  
  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Connect to the WebSocket server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = await connect(wsUrl);
      
      return socket;
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      setError("Failed to connect to game server");
      setLoading(false);
      throw error;
    }
  }, [connect]);
  
  // Set websocket error
  useEffect(() => {
    if (wsError) {
      setError(wsError.message);
    }
  }, [wsError]);
  
  // If on game page, fetch initial game state when connected
  useEffect(() => {
    if (isConnected && socket && location.startsWith('/game/') && gameCode && gameCode !== 'lobby') {
      // Fetch game data if already in a game
      fetch(`/api/games/${gameCode}/state`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Game not found: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          // Set game data
          if (data) {
            setGameState({
              ...data,
              currentPlayerId: data.players[0]?.id // Temporary, will be updated by WebSocket
            });
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching game:", err);
          setError(err.message);
          setLoading(false);
        });
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
