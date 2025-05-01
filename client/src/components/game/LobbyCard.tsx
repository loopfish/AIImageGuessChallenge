import { useGameContext } from "@/hooks/use-game";
import PlayerList from "./PlayerList";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { GameMessageType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LobbyCard() {
  const { gameState, socket } = useGameContext();
  const { toast } = useToast();
  
  if (!gameState || !gameState.game) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <p className="text-center text-gray-500">Loading game lobby...</p>
      </div>
    );
  }
  
  // Debug logs
  console.log("Lobby Card - Game State:", gameState);
  console.log("Game info:", gameState.game);
  console.log("Players:", gameState.players);
  
  // Check if the current player is the host
  const isHost = gameState?.players?.some(player => 
    player.isHost && player.id === gameState.currentPlayerId
  ) || false;
  
  // Handler to delete the current game
  const handleDeleteGame = () => {
    if (!gameState?.game?.id) {
      toast({
        title: "Error",
        description: "Game ID is missing. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }
    
    // Show toast to inform user the game is being deleted
    toast({
      title: "Deleting Game",
      description: "Removing this game and redirecting to the home page...",
    });
    
    // Send delete game message to the server
    if (!socket) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    socket.send(JSON.stringify({
      type: GameMessageType.DELETE_GAME,
      payload: {
        gameId: gameState.game.id,
        sessionId: localStorage.getItem(`sessionId_${gameState.game.id}`) || undefined
      }
    }));
    
    // The server will handle the deletion and send a message to redirect all players
  };
  
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-4 text-center">
        <h3 className="text-xl font-heading font-semibold text-neutral-dark mb-1">Game Lobby</h3>
        <div className="flex items-center justify-center space-x-2">
          <span className="text-sm font-medium">Code:</span>
          <span className="bg-primary/10 text-primary px-2 py-1 rounded font-mono font-bold">
            {gameState.game.code}
          </span>
        </div>
      </div>
      
      <PlayerList />
      
      {/* Delete Game Button (Only visible to host) */}
      {isHost && (
        <div className="mt-4 flex justify-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex items-center gap-1">
                <Trash2 className="h-4 w-4" />
                Delete Game
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Game</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this game? This action cannot be undone,
                  and all players will be returned to the home page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteGame}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
