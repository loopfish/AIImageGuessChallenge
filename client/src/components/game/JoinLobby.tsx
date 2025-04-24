import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import { PlayerConnectionInfo } from "./PlayerConnectionInfo";

export default function JoinLobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { socket } = useGameContext();
  
  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const { setGameState } = useGameContext();
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !gameCode.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter your username and game code",
        variant: "destructive"
      });
      return;
    }
    
    if (!socket) {
      toast({
        title: "Connection error",
        description: "Unable to connect to game server",
        variant: "destructive"
      });
      return;
    }
    
    setIsJoining(true);
    
    try {
      // Set a preliminary game state to ensure the connection panel shows right away
      // This will be enhanced by the PLAYER_JOINED message and then replaced 
      // when the full GAME_STATE arrives from the server
      setGameState({
        game: { 
          code: gameCode,
          id: 0, // Placeholder values for required properties
          hostId: 0,
          status: "connecting",
          currentRound: 0,
          totalRounds: 0,
          timerSeconds: 60,
          createdAt: new Date()
        },
        players: [],
        isConnecting: true, // Special flag to indicate we're in the connecting state
        onlinePlayers: []
      });
      
      console.log("Set preliminary game state with isConnecting=true");
      
      // Join the game via WebSocket
      socket.send(JSON.stringify({
        type: GameMessageType.JOIN_GAME,
        payload: {
          username,
          gameCode,
        }
      }));
      
      // Navigate to the game page
      navigate(`/game/${gameCode}`);
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Error",
        description: "Failed to join the game. Please try again.",
        variant: "destructive"
      });
      setIsJoining(false);
    }
  };

  const { gameState, isConnected } = useGameContext();
  
  // Show connection info if either:
  // 1. Player has already joined a game with a player ID
  // 2. Player is in connecting state during join process
  if ((gameState?.currentPlayerId || gameState?.isConnecting) && isConnected) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <PlayerConnectionInfo />
        
        <Card>
          <CardHeader>
            <h2 className="text-xl font-heading font-semibold text-center text-green-800">
              {gameState?.isConnecting ? "Joining Game..." : "Connected to Game"}
            </h2>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              {gameState?.isConnecting 
                ? "Establishing connection..." 
                : "You've joined the game successfully!"}
            </p>
            <Button 
              onClick={() => navigate(`/game/${gameState.game?.code}`)}
              className="w-full"
            >
              Go to Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <h2 className="text-2xl font-heading font-semibold text-center">Join a Game</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Your Name</Label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gameCode">Game Code</Label>
            <Input
              id="gameCode"
              placeholder="Enter the game code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              required
            />
            <p className="text-sm text-gray-500">Ask the game host for the code</p>
          </div>
          
          <Button 
            type="submit" 
            disabled={isJoining} 
            className="w-full"
          >
            {isJoining ? "Joining..." : "Join Game"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
