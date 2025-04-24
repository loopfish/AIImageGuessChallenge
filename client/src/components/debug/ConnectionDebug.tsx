import { useGameContext } from "@/hooks/use-game";
import { useEffect, useState } from "react";

export default function ConnectionDebug() {
  const { gameState, isConnected, socket } = useGameContext();
  const [showDebug, setShowDebug] = useState(false);
  const [heartbeatLogs, setHeartbeatLogs] = useState<string[]>([]);
  
  // Game state info
  const currentPlayerId = gameState?.currentPlayerId;
  const gameId = gameState?.game?.id;
  const onlinePlayers = gameState?.onlinePlayers || [];
  const players = gameState?.players || [];
  
  // Log heartbeat info
  useEffect(() => {
    if (!socket || !isConnected || !currentPlayerId || !gameId) return;
    
    const sendDebugHeartbeat = () => {
      try {
        // Log the heartbeat we're about to send
        const timestamp = Date.now();
        const newLog = `Sending heartbeat: playerId=${currentPlayerId}, gameId=${gameId}, timestamp=${timestamp}`;
        
        setHeartbeatLogs(prev => {
          const newLogs = [newLog, ...prev];
          // Keep only the last 5 logs
          return newLogs.slice(0, 5);
        });
        
        // Actually send the heartbeat
        socket.send(JSON.stringify({
          type: 'heartbeat',
          payload: {
            playerId: currentPlayerId,
            gameId,
            timestamp
          }
        }));
      } catch (error) {
        console.error("Error sending debug heartbeat:", error);
      }
    };
    
    // Send a debug heartbeat immediately
    sendDebugHeartbeat();
    
    // Set up interval for regular debug heartbeats (every 5 seconds)
    const interval = setInterval(sendDebugHeartbeat, 5000);
    
    return () => clearInterval(interval);
  }, [socket, isConnected, currentPlayerId, gameId]);
  
  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-md text-xs opacity-50 hover:opacity-100"
      >
        Show Debug
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-md text-xs w-96 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Connection Debug</h3>
        <button 
          onClick={() => setShowDebug(false)}
          className="text-gray-400 hover:text-white"
        >
          Hide
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <p><span className="font-bold">Connection:</span> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
          <p><span className="font-bold">Player ID:</span> {currentPlayerId || 'Unknown'}</p>
          <p><span className="font-bold">Game ID:</span> {gameId || 'Unknown'}</p>
        </div>
        <div>
          <p className="font-bold">Online Players:</p>
          <ul>
            {onlinePlayers.map(playerId => (
              <li key={playerId}>
                {playerId} - {players.find(p => p.id === playerId)?.username || 'Unknown'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div>
        <p className="font-bold">Heartbeat Logs:</p>
        <ul className="border border-gray-700 p-2 rounded">
          {heartbeatLogs.map((log, i) => (
            <li key={i} className="text-gray-400 mb-1">{log}</li>
          ))}
        </ul>
      </div>
      
      <div className="mt-4">
        <button 
          onClick={() => {
            if (!socket || !isConnected || !currentPlayerId || !gameId) return;
            
            // Force send a heartbeat
            const timestamp = Date.now();
            socket.send(JSON.stringify({
              type: 'heartbeat',
              payload: {
                playerId: currentPlayerId,
                gameId,
                timestamp
              }
            }));
            
            // Log it
            setHeartbeatLogs(prev => {
              const newLogs = [`MANUAL heartbeat: playerId=${currentPlayerId}, gameId=${gameId}, timestamp=${timestamp}`, ...prev];
              return newLogs.slice(0, 5);
            });
          }}
          className="bg-primary text-white px-3 py-1 rounded text-xs"
        >
          Force Heartbeat
        </button>
      </div>
    </div>
  );
}