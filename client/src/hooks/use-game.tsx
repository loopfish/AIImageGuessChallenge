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
  
  // Track whether we need to fetch game data
  const hasInitiallyFetched = useRef(false);
  
  // Get URL info for game code
  const gameCode = useMemo(() => {
    const urlParts = location.split('/');
    return urlParts[urlParts.length - 1];
  }, [location]);
  
  // Store/retrieve player data in localStorage
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
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("WebSocket message:", message.type);
      
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
  
  // Simple WebSocket setup with no dependencies on socket or isConnected
  const { 
    socket, 
    isConnected, 
    connect,
    error: wsError 
  } = useWebSocket({
    autoConnect: false,
    onMessage: handleWebSocketMessage,
    reconnectAttempts: 5,
    reconnectInterval: 3000
  });
  
  // Connect to WebSocket
  const connectWebSocket = useCallback(async () => {
    try {
      if (socket && socket.readyState === WebSocket.OPEN) {
        return socket;
      }
      
      setLoading(true);
      setError(null);
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      console.log("Connecting to WebSocket at:", wsUrl);
      
      return await connect(wsUrl);
    } catch (error) {
      console.error("Connection failed:", error);
      setError("Failed to connect to game server");
      setLoading(false);
      throw error;
    }
  }, [connect, socket]);
  
  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      setError(wsError.message);
    }
  }, [wsError]);
  
  // Fetch game state when on a game page
  useEffect(() => {
    // Only run once for the combination of socket + game code
    const shouldFetchData = isConnected && 
      socket && 
      location.startsWith('/game/') && 
      gameCode && 
      gameCode !== 'lobby' && 
      !hasInitiallyFetched.current;
      
    if (shouldFetchData) {
      hasInitiallyFetched.current = true;
      setLoading(true);
      
      const apiUrl = `/api/games/${gameCode}/state`;
      console.log("Fetching game state:", apiUrl);
      
      fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Game not found: ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data) {
            const savedPlayerId = getCurrentPlayerFromStorage();
            let currentPlayerId;
            
            if (savedPlayerId && data.players) {
              const existingPlayer = data.players.find((p: any) => p.id === savedPlayerId);
              if (existingPlayer) {
                currentPlayerId = existingPlayer.id;
              }
            }
            
            if (!currentPlayerId && data.players && data.players.length > 0) {
              currentPlayerId = data.players[0]?.id;
              if (currentPlayerId) saveCurrentPlayerToStorage(currentPlayerId);
            }
            
            setGameState({ ...data, currentPlayerId });
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Error:", err);
          setError(err.message);
          setLoading(false);
        });
    } else if (location === '/') {
      // On home page, not in a game
      setLoading(false);
    }
  }, [isConnected, socket, location, gameCode, getCurrentPlayerFromStorage, saveCurrentPlayerToStorage]);
  
  // Check for reconnection on location change
  useEffect(() => {
    if (location.startsWith('/game/') && gameCode !== 'lobby') {
      hasInitiallyFetched.current = false; // Reset to allow fetching on new game
    }
  }, [location, gameCode]);
  
  // Track if we've already sent a reconnection request
  const hasAttemptedReconnection = useRef(false);
  
  // Send reconnection request when needed (only once)
  useEffect(() => {
    // Only attempt reconnection once when socket is connected
    if (isConnected && socket && !hasAttemptedReconnection.current) {
      hasAttemptedReconnection.current = true;
      
      const playerId = getCurrentPlayerFromStorage();
      let gameId = null;
      
      try {
        const storedGameId = localStorage.getItem('currentGameId');
        if (storedGameId) {
          gameId = parseInt(storedGameId, 10);
        }
      } catch (err) {
        console.error("Error reading game ID:", err);
      }
      
      if (playerId && gameId) {
        console.log(`Attempting reconnection: player ${playerId}, game ${gameId}`);
        socket.send(JSON.stringify({
          type: GameMessageType.RECONNECT_REQUEST,
          payload: { playerId, gameId }
        }));
      }
    }
  }, [isConnected, socket, getCurrentPlayerFromStorage]);
  
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
