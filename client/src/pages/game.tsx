import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGameContext } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import HostLobby from "@/components/game/HostLobby";
import GamePlay from "@/components/game/GamePlay";
import ResultsScreen from "@/components/game/ResultsScreen";
import ConnectionDebug from "@/components/debug/ConnectionDebug";
import { GameLayout } from "@/components/layout/GameLayout";
import { Loader2 } from "lucide-react";
import { GameState, WebSocketMessage, GameMessageType } from "@shared/schema";

export default function Game() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { gameState, setGameState } = useGameContext();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasConnected, setHasConnected] = useState(false);
  
  // Store WebSocket connection
  const socketRef = useRef<WebSocket | null>(null);
  
  const { code } = params;
  
  // Fetch game data from API
  const fetchGameData = async (gameCode: string) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/games/${gameCode}/state`);
      
      if (!response.ok) {
        throw new Error(`Game not found: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data) {
        // Process player data
        let currentPlayerId: number | null = null;
        
        try {
          const savedId = localStorage.getItem('currentPlayerId');
          if (savedId && data.players) {
            const parsedId = parseInt(savedId, 10);
            if (data.players.some((p: any) => p.id === parsedId)) {
              currentPlayerId = parsedId;
            }
          }
        } catch (err) {
          console.error("Error getting player ID:", err);
        }
        
        // Default to first player if needed
        if (currentPlayerId === null && data.players && data.players.length > 0) {
          currentPlayerId = data.players[0]?.id ?? null;
          if (currentPlayerId !== null) {
            try {
              localStorage.setItem('currentPlayerId', currentPlayerId.toString());
            } catch (err) {
              console.error("Error saving player ID:", err);
            }
          }
        }
        
        // Update game state
        setGameState({
          ...data,
          currentPlayerId
        });
      }
    } catch (err: any) {
      console.error("Error fetching game:", err);
      setError(err.message);
      
      // Show error toast
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
      
      // Redirect to home after error
      setTimeout(() => navigate("/"), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to WebSocket and setup handlers with improved resilience
  useEffect(() => {
    // Special case for lobby
    if (code === 'lobby') {
      setIsLoading(false);
      return;
    }
    
    // Don't reconnect if we already have a connection
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    // Close any existing socket that's in a broken state
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState !== WebSocket.CLOSED) {
          socketRef.current.close();
        }
      } catch (e) {
        console.error("Error closing existing socket:", e);
      }
    }
    
    // Connect to the WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log("Connecting to WebSocket at:", wsUrl);
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error("WebSocket connection timeout");
      setError("Connection timeout. Please refresh the page.");
      setIsLoading(false);
    }, 5000);
    
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Store game state when connected so we can restore it if needed
      let gameStateBackup: any = null;
      
      // WebSocket event handlers
      socket.onopen = () => {
        console.log("WebSocket connected");
        setHasConnected(true);
        clearTimeout(connectionTimeout);
        
        // If we have a game code, fetch the game data
        if (code && code !== 'lobby') {
          fetchGameData(code);
        } else {
          setIsLoading(false);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("Received WebSocket message:", message.type);
          
          // Handle different types of WebSocket messages
          handleWebSocketMessage(message);
        } catch (err) {
          console.error("Error handling WebSocket message:", err);
        }
      };
      
      socket.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        
        // Only attempt reconnection if there was a connection issue, not if it was closed intentionally
        if (event.code !== 1000) {
          // Store current game state to maintain continuity
          gameStateBackup = { ...gameState };
          
          // Attempt to reconnect after a short delay
          setTimeout(() => {
            console.log("Attempting to reconnect to WebSocket...");
            if (socketRef.current?.readyState !== WebSocket.OPEN) {
              // Force recreation of the connection
              socketRef.current = null;
              
              // Connect immediately
              const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              const host = window.location.host;
              const newWsUrl = `${protocol}//${host}/ws`;
              
              try {
                const newSocket = new WebSocket(newWsUrl);
                socketRef.current = newSocket;
                
                newSocket.onopen = () => {
                  console.log("WebSocket reconnected successfully");
                  
                  // If we have a game code, re-fetch game data to restore state
                  if (code && code !== 'lobby') {
                    fetchGameData(code);
                  }
                };
                
                // Re-register all the other event handlers
                newSocket.onmessage = socket.onmessage;
                newSocket.onclose = socket.onclose;
                newSocket.onerror = socket.onerror;
              } catch (err) {
                console.error("Failed to reconnect to WebSocket:", err);
                setError("Connection lost. Please refresh the page.");
              }
            }
          }, 1000);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error occurred:", error);
        setError("Failed to connect to game server. Please try refreshing the page.");
        setIsLoading(false);
      };
      
      // Cleanup function
      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError("Failed to connect to game server");
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, toast, navigate, setGameState]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case GameMessageType.GAME_STATE:
        const gameData = message.payload as GameState;
        
        // Add current player ID if players exist
        if (gameData?.players?.length > 0) {
          let currentPlayerId: number | null = null;
          
          // Try to find player ID in localStorage
          try {
            const savedId = localStorage.getItem('currentPlayerId');
            if (savedId) {
              const parsedId = parseInt(savedId, 10);
              if (gameData.players.some((p: any) => p.id === parsedId)) {
                currentPlayerId = parsedId;
              }
            }
          } catch (err) {
            console.error("Error getting player ID:", err);
          }
          
          // Default to first player if needed
          if (currentPlayerId === null) {
            currentPlayerId = gameData.players[0]?.id ?? null;
            if (currentPlayerId !== null) {
              try {
                localStorage.setItem('currentPlayerId', currentPlayerId.toString());
              } catch (err) {
                console.error("Error saving player ID:", err);
              }
            }
          }
          
          // Add to game state
          gameData.currentPlayerId = currentPlayerId;
        }
        
        setGameState(gameData);
        setIsLoading(false);
        break;
      
      case GameMessageType.GAME_ERROR:
        setError(message.payload.message);
        
        // Show error toast
        toast({
          title: "Game Error",
          description: message.payload.message,
          variant: "destructive"
        });
        
        // Redirect to home after error
        setTimeout(() => navigate("/"), 3000);
        break;
        
      // Handle other message types by updating the game state
      case GameMessageType.PLAYER_UPDATE:
      case GameMessageType.ROUND_START:
      case GameMessageType.ROUND_END:
      case GameMessageType.PLAYER_GUESS:
      case GameMessageType.TIMER_UPDATE:
        if (gameState) {
          if (message.type === GameMessageType.PLAYER_UPDATE) {
            setGameState(prev => prev ? { ...prev, players: message.payload.players } : prev);
          } else if (message.type === GameMessageType.ROUND_START) {
            setGameState(prev => prev ? {
              ...prev,
              currentRound: message.payload.round,
              timeRemaining: message.payload.timeRemaining,
              game: { ...prev.game, status: "playing" }
            } : prev);
          } else if (message.type === GameMessageType.ROUND_END) {
            setGameState(prev => prev ? {
              ...prev,
              currentRound: message.payload.round,
              roundResults: message.payload.results,
              players: message.payload.standings,
              game: { ...prev.game, status: "round_end" }
            } : prev);
          } else if (message.type === GameMessageType.PLAYER_GUESS) {
            setGameState(prev => {
              if (!prev) return prev;
              const updatedGuesses = [...(prev.playerGuesses || []), message.payload];
              return { ...prev, playerGuesses: updatedGuesses };
            });
          } else if (message.type === GameMessageType.TIMER_UPDATE) {
            setGameState(prev => prev ? { ...prev, timeRemaining: message.payload.timeRemaining } : prev);
          }
        }
        break;
    }
  };
  
  // This function is now defined at the top of the component
  
  // Show loading state
  if (isLoading || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-gray-700">Loading game...</h2>
      </div>
    );
  }
  
  // Render appropriate view based on game state
  const renderGameView = () => {
    // Special case for lobby
    if (code === 'lobby') {
      return <HostLobby />;
    }
    
    if (!gameState || !gameState.game) {
      return (
        <div className="text-center p-8">
          <h2 className="text-2xl font-heading font-semibold text-neutral-dark mb-4">
            Game not found
          </h2>
          <p className="text-gray-600 mb-6">
            The game you're looking for doesn't exist or has ended.
          </p>
        </div>
      );
    }
  
    // Show view based on game status
    switch (gameState.game.status) {
      case "lobby":
        return <HostLobby />;
      
      case "playing":
        return <GamePlay />;
      
      case "round_end":
        return <ResultsScreen />;
      
      case "finished":
        return (
          <div className="text-center p-8 bg-white rounded-xl shadow-md">
            <h2 className="text-3xl font-heading font-bold text-primary mb-4">
              Game Over!
            </h2>
            <p className="text-gray-600 mb-6">
              Thanks for playing! The final scores are in.
            </p>
            <ResultsScreen />
          </div>
        );
      
      default:
        return <div>Unknown game state</div>;
    }
  };
  
  // Debug information
  console.log("Game page rendering with renderGameView", {
    hasGameState: Boolean(gameState),
    isLoading,
    error
  });

  // Always wrap content in GameLayout to ensure consistent connection info display
  return (
    <GameLayout>
      <div className="game-container">
        {renderGameView()}
        <ConnectionDebug />
      </div>
    </GameLayout>
  );
}
