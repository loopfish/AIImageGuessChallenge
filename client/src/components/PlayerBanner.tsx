import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/hooks/use-game";
import { useLocation } from "wouter";

export default function PlayerBanner() {
  const { gameState, setGameState } = useGameContext();
  const [username, setUsername] = useState("");
  const [, navigate] = useLocation();
  
  // On component mount, load the username from localStorage or game state
  useEffect(() => {
    function loadPlayerName() {
      // First try to get the player name from game state
      if (gameState?.currentPlayerId && gameState?.players) {
        const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
        if (currentPlayer?.username) {
          console.log("Using player name from game state:", currentPlayer.username);
          setUsername(currentPlayer.username);
          return;
        }
      }
      
      // If no player info in game state, try localStorage
      try {
        // Try to get from localStorage using normal key first
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
          console.log("Using player name from localStorage:", savedName);
          setUsername(savedName);
          return;
        }
      } catch (error) {
        console.error("Error loading username from localStorage:", error);
      }
    }
    
    loadPlayerName();
  }, [gameState]);
  
  // Handle logout - reset game state and navigate to home
  const handleLogout = () => {
    try {
      // Clear usernames from localStorage
      localStorage.removeItem('playerName');
      
      // Also clear hasEnteredName flag that Home component uses
      localStorage.removeItem('hasEnteredName');
      
      // Set a special flag to force the name prompt to appear
      localStorage.setItem('showNamePrompt', 'true');
      
      console.log("Logged out, cleared localStorage");
    } catch (error) {
      console.error("Error during logout:", error);
    }
    
    // Reset username in current component
    setUsername("");
    
    // Reset game state
    setGameState(null);
    
    // Navigate to home page
    navigate('/');
  };
  
  return (
    <div className="player-banner flex items-center justify-between w-full">
      <div>
        {username ? (
          // If username exists, show the player info as a simple name with status
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm">{username}</span>
            </div>
            
            {gameState?.currentPlayerId && (
              <span className="text-[10px] text-white/75 leading-tight">
                {gameState.game?.status === "playing" ? "Playing" : "In lobby"}
              </span>
            )}
          </div>
        ) : (
          // Empty div to maintain layout
          <div></div>
        )}
      </div>
      
      {/* Logout button - only show if username exists */}
      {username && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-white/70 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      )}
    </div>
  );
}