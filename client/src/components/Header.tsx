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
    function loadPlayerName() {
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
    }
    
    // Load player name immediately
    loadPlayerName();
    
    // Listen for player name change events
    const handlePlayerNameChanged = (event: any) => {
      console.log("Header - Received playerNameChanged event:", event.detail);
      if (event.detail?.username) {
        setUsername(event.detail.username);
      }
    };
    
    // Add event listener
    window.addEventListener('playerNameChanged', handlePlayerNameChanged);
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('playerNameChanged', handlePlayerNameChanged);
    };
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
        
        <div className="flex items-center gap-6">
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
                  className={`hover:text-accent transition-colors duration-200 whitespace-nowrap ${location === "/how-to-play" ? "text-accent" : ""}`}
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
          <div className="bg-primary-foreground/10 py-1 px-3 rounded-full flex items-center w-full max-w-[180px]">
            {username ? (
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm">{username}</span>
                </div>
                
                {gameState?.currentPlayerId && (
                  <span className="text-[10px] text-white/75 leading-tight">
                    {gameState.game?.status === "playing" ? "Playing" : "In lobby"}
                  </span>
                )}
                
                {/* Logout button moved under player name */}
                <div className="mt-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white/70 hover:text-white p-0 h-6"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    <span className="text-xs">Logout</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}