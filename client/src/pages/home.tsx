import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, UserRound, PlusCircle, LogIn, RefreshCw, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import JoinLobby from "@/components/game/JoinLobby";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useQuery } from '@tanstack/react-query';
import { GameLobbyList } from "@/components/game/GameLobbyList";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { socket, connectWebSocket } = useGameContext();
  
  // Player info state
  const [username, setUsername] = useState("");
  const [hasEnteredName, setHasEnteredName] = useState(false);
  
  // Game creation state
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [timerSeconds, setTimerSeconds] = useState("60");
  const [totalRounds, setTotalRounds] = useState("5");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [gamePassword, setGamePassword] = useState("");
  const [activeTab, setActiveTab] = useState("createRoom");
  
  // Define the GameLobby type
  interface GameLobby {
    id: number;
    code: string;
    status: string;
    roomName: string | null;
    hasPassword: boolean;
    currentRound: number;
    totalRounds: number;
    timerSeconds: number;
    createdAt: string;
  }
  
  // Query for game lobbies
  const { data: lobbies, isLoading: lobbiesLoading, error: lobbiesError, refetch: refetchLobbies } = useQuery<GameLobby[]>({
    queryKey: ['/api/games'],
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: activeTab === 'joinRoom', // Only fetch when on join tab
  });

  // Check if the user already has a name saved
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('playerName');
      const showPrompt = localStorage.getItem('showNamePrompt');
      
      console.log("Home - Initial state check:", {
        savedName,
        showPrompt,
        hasEnteredName
      });
      
      if (savedName && !showPrompt) {
        setUsername(savedName);
        // If they already have a name and haven't explicitly logged out, they can skip the first step
        setHasEnteredName(true);
        console.log("Home - User has a saved name, skipping to lobby");
      } else if (showPrompt) {
        // If they explicitly logged out, clear the flag and show the name prompt
        localStorage.removeItem('showNamePrompt');
        setHasEnteredName(false);
        console.log("Home - User logged out, showing name prompt");
      } else {
        // Make sure we don't have a stale hasEnteredName state
        const hasNameFlag = localStorage.getItem('hasEnteredName');
        if (!hasNameFlag) {
          setHasEnteredName(false);
          console.log("Home - No saved name or flags, showing name prompt");
        }
      }
    } catch (error) {
      console.error("Error checking initial state:", error);
    }
  }, []);

  // Handle saving the username and proceeding to the next step
  const handleNameSubmit = () => {
    if (!username.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue",
        variant: "destructive"
      });
      return;
    }
    
    // Save name for future sessions with extra debugging
    try {
      // Always use the main playerName key for simpler access
      localStorage.setItem('playerName', username);
      
      // Set hasEnteredName flag
      localStorage.setItem('hasEnteredName', 'true');
      
      // Clear any logout flags
      localStorage.removeItem('showNamePrompt');
      
      // Debug what we're saving
      console.log("Saved username to localStorage:", {
        username,
        hasEnteredName: true,
        showNamePrompt: null
      });
    } catch (error) {
      console.error("Error saving username:", error);
    }
    
    // Update the state to advance to the next screen
    setHasEnteredName(true);
    
    // Dispatch a custom event to notify other components (like Header) that the name has changed
    window.dispatchEvent(new CustomEvent('playerNameChanged', { 
      detail: { username } 
    }));
  };

  // Handle creating a new private game room
  const handleCreateGame = async () => {
    if (!roomName.trim()) {
      toast({
        title: "Room name required",
        description: "Please enter a name for your room",
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
      
      // Create the game via WebSocket, now including room name and password
      currentSocket.send(JSON.stringify({
        type: GameMessageType.CREATE_GAME,
        payload: {
          username,
          timerSeconds: parseInt(timerSeconds),
          totalRounds: parseInt(totalRounds),
          roomName: roomName,
          roomPassword: roomPassword, // Will be empty string if no password
          sessionId: generateSessionId() // Generate a unique session ID for this tab
        }
      }));
      
      // The game creation will be handled by the server (websocket.ts)
      // We'll add a listener specifically for game creation response
      const gameCreatedHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === GameMessageType.GAME_STATE && message.payload.game) {
            const gameCode = message.payload.game.code;
            
            // Save the game code to localStorage for reconnection purposes
            try {
              localStorage.setItem('lastGameCode', gameCode);
              localStorage.setItem('lastGameTimestamp', Date.now().toString());
            } catch (err) {
              // Silent fail on localStorage errors
            }
            
            toast({
              title: "Room created",
              description: `Room code: ${gameCode}. Share this with friends to join!`
            });
            
            // Clean up this one-time event listener
            currentSocket.removeEventListener('message', gameCreatedHandler);
            
            // Navigate to the actual game with the code
            navigate(`/game/${gameCode}`);
          }
        } catch (error) {
          // Silent fail on message parsing errors
        }
      };
      
      // Add the temporary listener for game creation
      currentSocket.addEventListener('message', gameCreatedHandler);
      
      // Set a longer timeout and a more robust fallback
      setTimeout(() => {
        // Check if we got a game code in localStorage from another listener
        let savedGameCode;
        try {
          savedGameCode = localStorage.getItem('lastGameCode');
          const timestamp = localStorage.getItem('lastGameTimestamp');
          
          // Only use this code if it's recent (set in the last 10 seconds)
          if (savedGameCode && timestamp && (Date.now() - parseInt(timestamp)) < 10000) {
            currentSocket.removeEventListener('message', gameCreatedHandler);
            toast({
              title: "Room created",
              description: `Room code: ${savedGameCode}. Share this with friends to join!`
            });
            navigate(`/game/${savedGameCode}`);
            return;
          }
        } catch (err) {
          // Silent fail on localStorage errors
        }
        
        // If we reach here, we didn't get a proper response
        currentSocket.removeEventListener('message', gameCreatedHandler);
        toast({
          title: "Room ready",
          description: "Redirecting to game setup..."
        });
        navigate("/game/lobby");
      }, 5000); // 5 second timeout
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create the room. Please try again.",
        variant: "destructive"
      });
      setIsCreating(false);
    }
  };

  // Handle joining an existing game room with a code
  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      toast({
        title: "Room code required",
        description: "Please enter a room code to join",
        variant: "destructive"
      });
      return;
    }
    
    setIsJoining(true);
    
    try {
      // Connect to WebSocket if not already connected
      let currentSocket = socket;
      if (!currentSocket) {
        currentSocket = await connectWebSocket();
      }
      
      // Check if this game needs a password by looking in the game list
      const selectedGame = lobbies?.find(game => game.code === gameCode);
      
      // If the game has a password and we don't have one provided, notify the user
      if (selectedGame?.hasPassword && !gamePassword.trim()) {
        toast({
          title: "Password Required",
          description: "This room is password protected. Please enter the password.",
          variant: "destructive"
        });
        // Focus on the password field
        document.getElementById('game-password')?.focus();
        setIsJoining(false);
        return;
      }
      
      // Join the game via WebSocket
      currentSocket.send(JSON.stringify({
        type: GameMessageType.JOIN_GAME,
        payload: {
          username,
          gameCode,
          password: gamePassword, // Will be empty string if no password needed
          sessionId: generateSessionId() // Generate a unique session ID for this tab
        }
      }));
      
      // Navigate to game page, the join logic is handled in the GamePage component
      navigate(`/game/${gameCode}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join the room. Please try again.",
        variant: "destructive"
      });
      setIsJoining(false);
    }
  };

  // Generate a unique session ID for this browser tab
  const generateSessionId = () => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sessionId = `session_${timestamp}_${randomStr}`;
    
    try {
      localStorage.setItem('sessionId', sessionId);
    } catch (err) {
      // Silent fail on localStorage errors
    }
    
    return sessionId;
  };
  
  // If user hasn't entered their name yet, show the name entry screen
  if (!hasEnteredName) {
    return (
      <div className="max-w-md mx-auto mt-20 fadeInUp">
        <Card className="bg-white shadow-lg">
          <CardHeader className="text-center">
            <UserRound className="w-12 h-12 mx-auto text-primary mb-2" />
            <h1 className="text-2xl font-heading font-bold">Welcome to the AI Prompt Guessing Game</h1>
            <p className="text-gray-500 text-sm mt-2">
              Challenge your friends to guess the prompts behind AI-generated images
            </p>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="player-name">Enter Your Name</Label>
                <Input
                  id="player-name"
                  placeholder="Your name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && username.trim()) {
                      handleNameSubmit();
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              onClick={handleNameSubmit} 
              disabled={!username.trim()} 
              className="w-full py-5"
            >
              Enter Game Lobby
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Main lobby screen after name is entered
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
      
      <Tabs defaultValue="createRoom" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="createRoom">
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Room
          </TabsTrigger>
          <TabsTrigger value="joinRoom">
            <LogIn className="h-4 w-4 mr-2" />
            Join Room
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="createRoom" className="mt-4">
          <Card className="border shadow-md">
            <CardHeader>
              <h2 className="text-2xl font-heading font-semibold">Create a Private Room</h2>
              <p className="text-gray-500 text-sm">Create a room and invite friends to play</p>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room Name</Label>
                  <Input
                    id="room-name"
                    placeholder="Enter a room name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="room-password">Room Password (Optional)</Label>
                  <Input
                    id="room-password"
                    type="password"
                    placeholder="Leave blank for no password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Add a password to make this room private</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timer">Round Timer</Label>
                    <select
                      id="timer"
                      className="w-full border border-input rounded-md h-10 px-3"
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="rounds">Number of Rounds</Label>
                    <select
                      id="rounds"
                      className="w-full border border-input rounded-md h-10 px-3"
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
              </div>
            </CardContent>
            
            <CardFooter>
              <Button
                onClick={handleCreateGame}
                disabled={isCreating || !roomName.trim()}
                className="w-full py-5"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="joinRoom" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column: Manual code entry */}
            <Card className="border shadow-md">
              <CardHeader>
                <h2 className="text-xl font-heading font-semibold">Join with Code</h2>
                <p className="text-gray-500 text-sm">Enter a room code to join an existing game</p>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="game-code">Room Code</Label>
                    <Input
                      id="game-code"
                      placeholder="Enter room code"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="game-password">Room Password (if required)</Label>
                    <Input
                      id="game-password"
                      type="password"
                      placeholder="Leave blank if no password"
                      value={gamePassword}
                      onChange={(e) => setGamePassword(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button
                  onClick={handleJoinGame}
                  disabled={isJoining || !gameCode.trim()}
                  className="w-full"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining Room...
                    </>
                  ) : (
                    "Join Room"
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Right column: Available rooms list */}
            <Card className="border shadow-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-heading font-semibold">Available Rooms</h2>
                    <p className="text-gray-500 text-sm">Browse active game rooms</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchLobbies()}
                    className="flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {lobbiesLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-gray-500">Loading available rooms...</p>
                  </div>
                ) : lobbiesError ? (
                  <div className="py-8 text-center">
                    <p className="text-red-500 mb-2">Failed to load available rooms</p>
                    <Button onClick={() => refetchLobbies()} variant="outline" size="sm">Try Again</Button>
                  </div>
                ) : !lobbies || lobbies.length === 0 ? (
                  <div className="py-8 text-center border rounded-lg bg-gray-50">
                    <p className="text-gray-500 mb-3">No active rooms found</p>
                    <p className="text-sm text-gray-400">Create a new room or check back later</p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-auto max-h-[400px] pr-2">
                    {lobbies.map(game => (
                      <div key={game.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium truncate">
                              {game.roomName || `Game #${game.id}`}
                              {game.hasPassword && (
                                <span className="inline-block ml-1">
                                  <Lock className="h-3 w-3 text-amber-500" />
                                </span>
                              )}
                            </h3>
                            <div className="text-xs text-gray-500">Code: {game.code}</div>
                          </div>
                          <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {game.totalRounds} rounds
                          </div>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="text-xs text-gray-600">
                            Timer: {game.timerSeconds}s
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setGameCode(game.code);
                              if (game.hasPassword) {
                                // Focus on password field if needed
                                document.getElementById('game-password')?.focus();
                              } else {
                                // Direct join if no password
                                handleJoinGame();
                              }
                            }}
                          >
                            Join
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-12 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-heading font-semibold mb-3">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li><span className="font-medium">Create a room</span> and share the code with friends</li>
          <li>As the host, <span className="font-medium">enter a prompt</span> to generate an AI image</li>
          <li>Players try to <span className="font-medium">guess the original prompt</span> used to create the image</li>
          <li>Score points based on how many words you match and how quickly you guess</li>
          <li>The player with the most points at the end wins!</li>
        </ol>
      </div>
    </div>
  );
}
