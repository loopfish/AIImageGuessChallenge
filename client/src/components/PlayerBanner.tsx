import { useState, useEffect } from "react";
import { UserRound, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useGameContext } from "@/hooks/use-game";

export default function PlayerBanner() {
  const { gameState } = useGameContext();
  const [username, setUsername] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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
  
  // Save username to localStorage and close dialog
  const handleSaveUsername = () => {
    if (username.trim()) {
      try {
        localStorage.setItem(playerNameKey, username);
        localStorage.setItem('playerName', username); // For backward compatibility
      } catch (error) {
        // Silent fail on localStorage errors
      }
    }
    setIsDialogOpen(false);
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return name.substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };
  
  // Get a consistent color for the user
  const getAvatarColor = (name: string) => {
    if (!name) return "bg-gray-400";
    
    const colors = [
      "bg-primary text-primary-foreground", 
      "bg-purple-500 text-white", 
      "bg-green-500 text-white", 
      "bg-orange-500 text-white",
      "bg-blue-500 text-white",
      "bg-indigo-500 text-white",
      "bg-pink-500 text-white",
      "bg-secondary text-secondary-foreground"
    ];
    
    // Simple hash function to get a consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <div className="player-banner">
      {username ? (
        // If username exists, show the player info as a simple name with status
        <div className="group flex flex-col">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{username}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-full text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsDialogOpen(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          
          {gameState?.currentPlayerId && (
            <span className="text-[10px] text-white/75 leading-tight">
              {gameState.game?.status === "playing" ? "Playing" : "In lobby"}
            </span>
          )}
        </div>
      ) : (
        // If no username, show a button to set one
        <Button size="sm" className="gap-2" onClick={() => setIsDialogOpen(true)}>
          <UserRound className="h-4 w-4" />
          Set Your Name
        </Button>
      )}
      
      {/* Edit Name Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Player Name</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This name will be visible to other players in the game.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">Player Name</Label>
                <Input
                  id="username"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={15}
                  autoFocus
                  className="bg-white text-gray-900 border-gray-300 dark:bg-zinc-800 dark:text-gray-100 dark:border-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum 15 characters
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUsername} 
                disabled={!username.trim()}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}