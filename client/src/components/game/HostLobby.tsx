import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlayIcon, Loader2 } from "lucide-react";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import LobbyCard from "./LobbyCard";
import { PlayerConnectionInfo } from "./PlayerConnectionInfo";

export default function HostLobby() {
  const { gameState, socket, isConnected } = useGameContext();
  const { toast } = useToast();
  
  const [prompt, setPrompt] = useState("");
  const [timerSeconds, setTimerSeconds] = useState("60");
  const [totalRounds, setTotalRounds] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [imageGenerated, setImageGenerated] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Check if the current player is the host by matching player IDs
  const isHost = gameState?.players?.some(player => 
    player.isHost && player.id === gameState.currentPlayerId
  ) || false;
  
  // Debug logs
  console.log("Game State:", gameState);
  console.log("Current Player ID:", gameState?.currentPlayerId);
  console.log("Game Players:", gameState?.players);
  
  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt first!",
        variant: "destructive"
      });
      return;
    }
    
    setGenerating(true);
    
    try {
      // Make a real API call to generate the image
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate image: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.imageUrl) {
        // Store the generated image URL in the game state
        // We'll store it temporarily in the component, the actual URL will be set
        // in the round object when the game starts
        setGenerating(false);
        setImageGenerated(true);
        setPreviewImageUrl(data.imageUrl);
        
        console.log("Generated image URL:", data.imageUrl);
      } else {
        throw new Error("No image URL in the response");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description: "Failed to generate the image. Please try again.",
        variant: "destructive"
      });
      setGenerating(false);
      // Don't set imageGenerated to true on error
    }
  };
  
  const handleStartGame = () => {
    if (!imageGenerated) {
      toast({
        title: "Error",
        description: "Please generate an image first!",
        variant: "destructive"
      });
      return;
    }
    
    if (!isConnected || !socket) {
      toast({
        title: "Connection Error",
        description: "Not connected to the game server",
        variant: "destructive"
      });
      return;
    }
    
    // Send start game message with the prompt
    if (!gameState?.game?.id) {
      toast({
        title: "Error",
        description: "Game ID is missing. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }
    
    // Show loading state while game starts
    setStartingGame(true);
    
    // Show toast to inform user the game is starting
    toast({
      title: "Starting Game",
      description: "Setting up the game and generating the first round...",
    });
    
    console.log(`Starting game with ID: ${gameState.game.id} and prompt: ${prompt}`);
    console.log(`Using pre-generated image URL: ${previewImageUrl}`);
    
    socket.send(JSON.stringify({
      type: GameMessageType.START_GAME,
      payload: {
        gameId: gameState.game.id,
        prompt: prompt,
        imageUrl: previewImageUrl
      }
    }));
    
    // The game state will change when the server responds, which will navigate away from this screen
  };
  
  if (!isHost) {
    return (
      <div className="player-lobby scale-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="text-center p-8 bg-white rounded-xl shadow-md">
              <h2 className="text-2xl font-heading font-semibold text-neutral-dark mb-3">
                Waiting for the host to start the game
              </h2>
              <div className="max-w-md mx-auto">
                <p className="text-gray-600 mb-6">
                  The game host will set up the game and generate the first image. 
                  Once ready, the game will automatically start for everyone.
                </p>
                <div className="bg-primary/10 rounded-lg p-4 inline-block mb-4">
                  <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                </div>
                <div className="flex justify-center items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Connected to game room: <span className="font-medium">{gameState?.game?.code}</span></span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Player Lobby */}
          <div className="space-y-4">
            {/* Player List */}
            <LobbyCard />
          </div>
        </div>
      </div>
    );
  }
  
  // Debug log for the host lobby component
  console.log("HostLobby component rendering with state:", {
    gameState,
    isConnected
  });

  return (
    <div className="host-lobby scale-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Game Setup */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <h2 className="text-2xl font-heading font-semibold text-neutral-dark">Game Setup</h2>
            
            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                Enter Image Prompt
              </Label>
              <div className="mt-1 space-y-2">
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[80px] resize-y"
                  placeholder="A cat wearing sunglasses on a beach"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleGenerateImage}
                    disabled={generating || !prompt.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Generating...
                      </>
                    ) : (
                      "Generate Image"
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">Be creative! This is what players will try to guess.</p>
            </div>
            
            {/* Game Settings */}
            <div className="game-settings space-y-4 pt-2">
              <h3 className="text-lg font-heading font-medium text-neutral-dark">Game Settings</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Timer Setting */}
                <div>
                  <Label htmlFor="timer" className="block text-sm font-medium text-gray-700">
                    Round Timer (seconds)
                  </Label>
                  <Select value={timerSeconds} onValueChange={setTimerSeconds}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="45">45 seconds</SelectItem>
                      <SelectItem value="60">60 seconds</SelectItem>
                      <SelectItem value="90">90 seconds</SelectItem>
                      <SelectItem value="120">120 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Rounds Setting */}
                <div>
                  <Label htmlFor="rounds" className="block text-sm font-medium text-gray-700">
                    Number of Rounds
                  </Label>
                  <Select value={totalRounds} onValueChange={setTotalRounds}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select rounds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 rounds</SelectItem>
                      <SelectItem value="5">5 rounds</SelectItem>
                      <SelectItem value="7">7 rounds</SelectItem>
                      <SelectItem value="10">10 rounds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* AI-Generated Image Preview */}
            <div className={`image-preview mt-4 ${imageGenerated ? 'block' : 'hidden'}`}>
              <h3 className="text-lg font-heading font-medium text-neutral-dark mb-2">Generated Image</h3>
              <div className="relative rounded-lg overflow-hidden bg-gray-100 h-64 flex items-center justify-center">
                <div className={`absolute inset-0 bg-gray-200 flex items-center justify-center ${generating ? 'block' : 'hidden'}`}>
                  <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
                  <span className="ml-2 text-gray-500">Generating image...</span>
                </div>
                {/* Image will be loaded from gameState?.currentRound?.imageUrl when available */}
                <img 
                  className={`object-contain w-full h-full ${generating ? 'hidden' : 'block'}`} 
                  src={previewImageUrl || gameState?.currentRound?.imageUrl || "https://placehold.co/800x600/5D3FD3/FFFFFF"} 
                  alt="AI-generated image for guessing game" 
                />
              </div>
              {/* Image generation notice removed as requested */}
            </div>
          </div>
          
          {/* Start Game Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleStartGame}
              disabled={!imageGenerated || !isConnected || startingGame}
              className="px-6 py-7 transition-all duration-200 transform hover:scale-105"
            >
              {startingGame ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Starting Game...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5 mr-2" />
                  Start Game
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Right Column: Player Lobby */}
        <div className="space-y-4">
          {/* Player List */}
          <LobbyCard />
        </div>
      </div>
    </div>
  );
}
