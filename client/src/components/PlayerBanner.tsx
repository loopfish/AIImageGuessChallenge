import { useState, useEffect } from "react";
import { UserRound, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog } from "@radix-ui/react-dialog";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {username ? (
          // If username exists, show the player info with Drawasaurus-style
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Avatar className={`h-8 w-8 ${getAvatarColor(username)}`}>
                <AvatarFallback>{getInitials(username)}</AvatarFallback>
              </Avatar>
              
              {/* Hidden edit button that appears on hover */}
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 absolute -top-2 -right-2 rounded-full bg-white shadow-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </DialogTrigger>
            </div>
            
            <div className="flex flex-col">
              <span className="font-medium text-xs leading-tight">{username}</span>
              {gameState?.currentPlayerId && (
                <span className="text-[10px] text-white/75 leading-tight">
                  {gameState.game?.status === "playing" ? "Playing" : "In lobby"}
                </span>
              )}
            </div>
          </div>
        ) : (
          // If no username, show a button to set one
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserRound className="h-4 w-4" />
              Set Your Name
            </Button>
          </DialogTrigger>
        )}
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Player Name</DialogTitle>
            <DialogDescription>
              This name will be visible to other players in the game.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Player Name</Label>
              <Input
                id="username"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={15}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum 15 characters
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveUsername} disabled={!username.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}