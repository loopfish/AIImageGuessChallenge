import { Link, useLocation } from "wouter";
import { Hash, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useGameContext } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location, navigate] = useLocation();
  const { gameState, setGameState } = useGameContext();
  const [username, setUsername] = useState("");
  
  // Direct lookup of username from localStorage on mount and when location changes
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('playerName');
      console.log("Header - Loading player name from storage:", savedName);
      if (savedName) {
        setUsername(savedName);
      }
    } catch (error) {
      console.error("Error loading username from localStorage:", error);
    }
    
    // Also check game state for player name
    if (gameState?.currentPlayerId && gameState?.players) {
      const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
      if (currentPlayer?.username) {
        console.log("Header - Using player name from game state:", currentPlayer.username);
        setUsername(currentPlayer.username);
      }
    }
  }, [location, gameState]);
  
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
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto py-4 px-6 flex justify-between items-center">
        <div className="flex items-center">
          <Hash className="h-8 w-8 mr-2" />
          <h1 className="text-2xl font-heading font-bold">Prompt Guesser</h1>
        </div>
        
        <div className="flex items-center gap-8">
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              <li>
                <Link 
                  href="/" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/" ? "text-accent" : ""}`}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/how-to-play" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/how-to-play" ? "text-accent" : ""}`}
                >
                  How to Play
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className={`hover:text-accent transition-colors duration-200 ${location === "/about" ? "text-accent" : ""}`}
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>
          
          {/* Player Banner */}
          <div className="bg-primary-foreground/10 py-1 px-3 rounded-full flex items-center justify-between w-full max-w-xs">
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
        </div>
      </div>
    </header>
  );
}
