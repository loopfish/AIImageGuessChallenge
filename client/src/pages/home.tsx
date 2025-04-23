import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import JoinLobby from "@/components/game/JoinLobby";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { socket, connectWebSocket } = useGameContext();
  
  const [username, setUsername] = useState("");
  const [timerSeconds, setTimerSeconds] = useState("60");
  const [totalRounds, setTotalRounds] = useState("5");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("host");

  const handleCreateGame = async () => {
    if (!username.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter your username",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Connect to WebSocket if not already connected
      let currentSocket = socket;
      if (!currentSocket) {
        currentSocket = await connectWebSocket();
      }
      
      // Create the game via WebSocket
      currentSocket.send(JSON.stringify({
        type: GameMessageType.CREATE_GAME,
        payload: {
          username,
          timerSeconds: parseInt(timerSeconds),
          totalRounds: parseInt(totalRounds)
        }
      }));
      
      // The game creation will be handled by the server (websocket.ts)
      // We'll add a listener specifically for game creation response
      const gameCreatedHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === GameMessageType.GAME_STATE && message.payload.game) {
            const gameCode = message.payload.game.code;
            toast({
              title: "Game created",
              description: `Game code: ${gameCode}. Redirecting to your game lobby...`
            });
            // Clean up this one-time event listener
            currentSocket.removeEventListener('message', gameCreatedHandler);
            // Navigate to the actual game with the code
            navigate(`/game/${gameCode}`);
          }
        } catch (error) {
          console.error("Error handling game creation response:", error);
        }
      };
      
      // Add the temporary listener for game creation
      currentSocket.addEventListener('message', gameCreatedHandler);
      
      // Set a fallback timeout in case we don't get a proper response
      setTimeout(() => {
        currentSocket.removeEventListener('message', gameCreatedHandler);
        toast({
          title: "Game lobby ready",
          description: "Redirecting to game setup..."
        });
        navigate("/game/lobby");
      }, 2000);
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Error",
        description: "Failed to create the game. Please try again.",
        variant: "destructive"
      });
      setIsCreating(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto fadeInUp">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-heading font-bold text-primary mb-2">
          Prompt Guesser
        </h1>
        <p className="text-lg text-gray-600">
          Challenge your friends to guess the prompts behind AI-generated images!
        </p>
      </div>
      
      <Tabs defaultValue="host" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="host">Host Game</TabsTrigger>
          <TabsTrigger value="join">Join Game</TabsTrigger>
        </TabsList>
        
        <TabsContent value="host" className="mt-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-heading font-semibold mb-4">Create a New Game</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <Input
                  id="username"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="timer" className="block text-sm font-medium text-gray-700 mb-1">
                    Round Timer (seconds)
                  </label>
                  <select
                    id="timer"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                  >
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
                    <option value="120">120 seconds</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="rounds" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Rounds
                  </label>
                  <select
                    id="rounds"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(e.target.value)}
                  >
                    <option value="3">3 rounds</option>
                    <option value="5">5 rounds</option>
                    <option value="7">7 rounds</option>
                    <option value="10">10 rounds</option>
                  </select>
                </div>
              </div>
              
              <Button
                onClick={handleCreateGame}
                disabled={isCreating || !username.trim()}
                className="w-full py-6 mt-4"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Game...
                  </>
                ) : (
                  "Create Game"
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="join">
          <JoinLobby />
        </TabsContent>
      </Tabs>
      
      <div className="mt-12 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-heading font-semibold mb-3">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li><span className="font-medium">Create a game</span> and share the code with friends</li>
          <li>As the host, <span className="font-medium">enter a prompt</span> to generate an AI image</li>
          <li>Players try to <span className="font-medium">guess the original prompt</span> used to create the image</li>
          <li>Score points based on how many words you match and how quickly you guess</li>
          <li>The player with the most points at the end wins!</li>
        </ol>
      </div>
    </div>
  );
}
