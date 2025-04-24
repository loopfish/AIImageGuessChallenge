import { useGameContext } from "@/hooks/use-game";

interface PlayerListProps {
  showScores?: boolean;
  className?: string;
}

export default function PlayerList({ showScores = false, className = "" }: PlayerListProps) {
  const { gameState } = useGameContext();
  
  const players = gameState?.players || [];
  const onlinePlayers = gameState?.onlinePlayers || [];
  const hostId = gameState?.game?.hostId;
  
  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden ${className}`}>
      <div className="bg-primary px-4 py-3 text-white">
        <div className="flex justify-between items-center">
          <h3 className="font-heading font-semibold">
            {showScores ? "Players & Scores" : "Game Lobby"}
          </h3>
          {!showScores && (
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-white text-primary">
              {players.length} Players
            </span>
          )}
        </div>
      </div>
      
      {!showScores && gameState?.game?.code && (
        <div className="p-5 border-b">
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-500 mb-1">Share this code to invite players:</span>
            <div className="flex items-center">
              <span className="text-3xl font-heading font-bold tracking-wide text-neutral-dark">
                {gameState.game.code}
              </span>
              <button 
                className="ml-2 text-primary hover:text-accent transition-colors duration-200"
                onClick={() => {
                  navigator.clipboard.writeText(gameState.game.code);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 max-h-96 overflow-y-auto">
        {!showScores && <h4 className="text-sm font-medium text-gray-500 mb-3">Players</h4>}
        
        {players.map((player, index) => (
          <div 
            key={player.id} 
            className={`flex items-center p-2 ${showScores ? 'border-b border-gray-100' : 'hover:bg-gray-50 rounded-md fadeInUp'}`}
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          >
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(index)} text-white flex items-center justify-center font-medium`}>
              {player.username.substring(0, 2).toUpperCase()}
            </div>
            <span className={`ml-2 font-medium ${showScores ? 'flex-grow truncate' : ''}`}>
              {player.username}
            </span>
            <div className="ml-auto flex items-center">
              {/* Online Status Indicator */}
              <span 
                className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${
                  onlinePlayers.includes(player.id) 
                    ? 'bg-green-500 animate-pulse' 
                    : 'bg-gray-300'
                }`} 
                title={onlinePlayers.includes(player.id) ? 'Online' : 'Offline'}
              />
              
              <span className="text-sm text-gray-600">
                {player.id === hostId ? "Host" : ""}
                {showScores && `${player.score} ${player.score === 1 ? 'pt' : 'pts'}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to get avatar color
function getAvatarColor(index: number): string {
  const colors = [
    "bg-secondary", 
    "bg-accent", 
    "bg-purple-500", 
    "bg-green-500", 
    "bg-orange-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-pink-500"
  ];
  return colors[index % colors.length];
}
