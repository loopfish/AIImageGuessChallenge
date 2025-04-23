import { useGameContext } from "@/hooks/use-game";
import PlayerList from "./PlayerList";

export default function LobbyCard() {
  const { gameState } = useGameContext();
  
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
    </div>
  );
}
