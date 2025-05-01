import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/hooks/use-game";
import { useLocation } from "wouter";

export default function PlayerBanner() {
  const { gameState, setGameState } = useGameContext();
  const [username, setUsername] = useState("");
  const [, navigate] = useLocation();
  
  // Generate a unique key for this browser tab to prevent conflicts between tabs
  const [sessionKey] = useState(() => {
    const existingKey = localStorage.getItem('sessionId');
    if (existingKey) return existingKey;
    
    const newKey = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('sessionId', newKey);
    return newKey;
  });
  
  // Use sessionKey as a prefix for localStorage keys to avoid conflicts between tabs
  const playerNameKey = `playerName_${sessionKey}`;
  
  // If in a game, use the current player's name
  useEffect(() => {
    if (gameState?.currentPlayerId) {
      const currentPlayer = gameState.players?.find(p => p.id === gameState.currentPlayerId);
      if (currentPlayer?.username) {
        setUsername(currentPlayer.username);
        try {
          localStorage.setItem(playerNameKey, currentPlayer.username);
        } catch (error) {
          // Silent fail on localStorage errors
        }
      }
    }
  }, [gameState?.currentPlayerId, gameState?.players, playerNameKey]);
  
  // Load username from localStorage on component mount (if not in a game)
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(playerNameKey) || localStorage.getItem('playerName');
      if (savedName && !username) {
        setUsername(savedName);
      }
    } catch (error) {
      // Silent fail on localStorage errors
    }
  }, [playerNameKey, username]);
  
  // Handle logout - reset game state and navigate to home
  const handleLogout = () => {
    try {
      // Clear usernames from all possible storages
      localStorage.removeItem(playerNameKey);
      localStorage.removeItem('playerName');
      
      // Also clear hasEnteredName flag that Home component uses
      localStorage.removeItem('hasEnteredName');
      
      // Set a special flag to force the name prompt to appear
      localStorage.setItem('showNamePrompt', 'true');
    } catch (error) {
      // Silent fail on localStorage errors
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