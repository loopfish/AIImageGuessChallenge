import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import { GameLayout } from "@/components/layout/GameLayout";
import { GameLobbyList } from "./GameLobbyList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * JoinLobby component that allows users to join an existing game
 * Now includes the option to browse and join available lobbies
 */
export default function JoinLobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { socket, gameState, setGameState, isConnected } = useGameContext();
  
  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  
  // Debug log for component
  console.log("JoinLobby component rendering with state:", {
    gameState,
    isConnected,
    isJoining
  });
  
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
    
    joinGame(gameCode);
  };

  const joinGame = (code: string) => {
    if (!username.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter your username",
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
          code: code,
          id: 0, // Placeholder values for required properties
          hostId: 0,
          status: "connecting",
          currentRound: 0,
          totalRounds: 0,
          timerSeconds: 60,
          createdAt: new Date(),
          roomName: null,
          roomPassword: null
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
          gameCode: code,
        }
      }));
      
      // Navigate to the game page
      navigate(`/game/${code}`);
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

  // Render content based on connection state
  const renderContent = () => {
    // Show connected/joining state if player is connected
    if ((gameState?.currentPlayerId || gameState?.isConnecting) && isConnected) {
      return (
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
      );
    }
    
    // Otherwise show the join form with tabs
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-heading font-semibold text-center">Join a Game</h2>
        </CardHeader>
        
        {/* Name input first, always visible */}
        <CardContent className="pb-2">
          <div className="space-y-2 mb-4">
            <Label htmlFor="username">Your Name</Label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <Tabs defaultValue="code" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">Enter Game Code</TabsTrigger>
              <TabsTrigger value="browse">Browse Games</TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="pt-4">
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
              
              <div className="mt-4">
                <Button 
                  onClick={handleSubmit}
                  disabled={isJoining || !username.trim() || !gameCode.trim()} 
                  className="w-full"
                >
                  {isJoining ? "Joining..." : "Join Game"}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="browse" className="pt-4">
              {username.trim() ? (
                <GameLobbyList username={username} onJoinGame={joinGame} />
              ) : (
                <div className="text-center py-6 text-gray-500">
                  Please enter your name above to browse available games
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  };
  
  // Wrap content in GameLayout instead of manually including PlayerConnectionInfo
  return (
    <GameLayout showConnectionInfo={true}>
      <div className="max-w-3xl mx-auto">
        {renderContent()}
      </div>
    </GameLayout>
  );
}
