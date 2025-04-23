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
  
  return <PlayerList />;
}
