import { useGameContext } from "@/hooks/use-game";
import { useEffect, useState } from "react";
import { GameMessageType } from "@shared/schema";

export default function ConnectionDebug() {
  const { gameState, isConnected, socket } = useGameContext();
  const [showDebug, setShowDebug] = useState(false);
  const [heartbeatLogs, setHeartbeatLogs] = useState<string[]>([]);
  
  // Game state info
  const currentPlayerId = gameState?.currentPlayerId;
  const gameId = gameState?.game?.id;
  const gameCode = gameState?.game?.code;
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
          type: GameMessageType.HEARTBEAT,
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
    
    // Don't automatically send debug heartbeats, as the main app already does this
    // We'll just allow manual sending
    
    return () => {};
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
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-md text-xs w-96 max-h-96 overflow-y-auto z-50">
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
          <p><span className="font-bold">Game Code:</span> {gameCode || 'Unknown'}</p>
        </div>
        <div>
          <p className="font-bold">Online Players:</p>
          <ul className="border border-gray-700 p-2 rounded max-h-24 overflow-y-auto">
            {onlinePlayers && onlinePlayers.length > 0 ? (
              onlinePlayers.map(playerId => (
                <li key={playerId} className="flex justify-between">
                  <span>{playerId === currentPlayerId ? '➡️' : ''} {players.find(p => p.id === playerId)?.username || 'Unknown'}</span>
                  <span className="text-green-400">{playerId}</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No online players</li>
            )}
          </ul>
          
          <p className="font-bold mt-2">All Players:</p>
          <ul className="border border-gray-700 p-2 rounded max-h-24 overflow-y-auto">
            {players && players.length > 0 ? (
              players.map(player => (
                <li key={player.id} className="flex justify-between">
                  <span>{player.id === currentPlayerId ? '➡️' : ''} {player.username}</span>
                  <span className={onlinePlayers.includes(player.id) ? "text-green-400" : "text-red-400"}>
                    {player.id} {onlinePlayers.includes(player.id) ? '🟢' : '🔴'}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No players</li>
            )}
          </ul>
        </div>
      </div>
      
      <div>
        <p className="font-bold">Heartbeat Logs:</p>
        <ul className="border border-gray-700 p-2 rounded max-h-24 overflow-y-auto">
          {heartbeatLogs.length > 0 ? (
            heartbeatLogs.map((log, i) => (
              <li key={i} className="text-gray-400 mb-1">{log}</li>
            ))
          ) : (
            <li className="text-gray-500">No heartbeat logs</li>
          )}
        </ul>
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button 
          onClick={() => {
            if (!socket || !isConnected || !currentPlayerId || !gameId) return;
            
            // Force send a heartbeat
            const timestamp = Date.now();
            socket.send(JSON.stringify({
              type: GameMessageType.HEARTBEAT,
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
          disabled={!isConnected || !currentPlayerId || !gameId}
        >
          Force Heartbeat
        </button>
        
        <button 
          onClick={() => {
            if (!socket || !isConnected || !gameCode) return;
            
            // Force reconnection request
            socket.send(JSON.stringify({
              type: GameMessageType.RECONNECT_REQUEST,
              payload: { 
                playerId: currentPlayerId,
                gameCode
              }
            }));
            
            // Log it
            setHeartbeatLogs(prev => {
              const newLogs = [`MANUAL reconnect request: playerId=${currentPlayerId}, gameCode=${gameCode}`, ...prev];
              return newLogs.slice(0, 5);
            });
          }}
          className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
          disabled={!isConnected || !gameCode}
        >
          Force Reconnect
        </button>
      </div>
    </div>
  );
}