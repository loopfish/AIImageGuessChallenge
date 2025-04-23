import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGameContext } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import HostLobby from "@/components/game/HostLobby";
import GamePlay from "@/components/game/GamePlay";
import ResultsScreen from "@/components/game/ResultsScreen";
import { Loader2 } from "lucide-react";

export default function Game() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { 
    gameState, 
    connectWebSocket, 
    isConnected, 
    loading, 
    error 
  } = useGameContext();
  
  const { code } = params;
  
  useEffect(() => {
    // Connect to WebSocket
    if (!isConnected) {
      connectWebSocket();
    }
  }, [isConnected, connectWebSocket]);
  
  // Handle connection or game loading error
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
      
      // Redirect to home if there's an error
      setTimeout(() => navigate("/"), 3000);
    }
  }, [error, toast, navigate]);
  
  // Show loading state
  if (loading || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-gray-700">Loading game...</h2>
      </div>
    );
  }
  
  // Determine which view to show based on game state
  const renderGameView = () => {
    if (!gameState.game) {
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
  
  return (
    <div className="game-container">
      {renderGameView()}
    </div>
  );
}
