import { Link, useLocation } from "wouter";
import { Hash, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useGameContext } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location, navigate] = useLocation();
  const { gameState, setGameState } = useGameContext();
  const [username, setUsername] = useState("");
  
  // Load username whenever location or gameState changes
  useEffect(() => {
    // First try to get from localStorage
    try {
      const savedName = localStorage.getItem('playerName');
      if (savedName) {
        console.log("Header - Found name in localStorage:", savedName);
        setUsername(savedName);
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
    }
    
    // Also check game state for player name (takes precedence)
    if (gameState?.currentPlayerId && gameState?.players) {
      const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
      if (currentPlayer?.username) {
        console.log("Header - Using player name from game state:", currentPlayer.username);
        setUsername(currentPlayer.username);
      }
    }
  }, [location, gameState]);
  
  // Handle logout
  const handleLogout = () => {
    try {
      // Clear name and game state
      localStorage.removeItem('playerName');
      localStorage.removeItem('hasEnteredName');
      localStorage.setItem('showNamePrompt', 'true');
      
      // Explicitly force page reload to ensure components reset correctly
      window.location.href = '/';
    } catch (error) {
      console.error("Error during logout:", error);
    }
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