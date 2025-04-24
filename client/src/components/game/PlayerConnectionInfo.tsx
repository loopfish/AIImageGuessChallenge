import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameContext } from "@/hooks/use-game";
import { UserIcon, WifiIcon, CrownIcon, CircleIcon } from "lucide-react";

/**
 * Component that displays the current player's connection information
 * and shows which players are currently online
 */
export function PlayerConnectionInfo() {
  const { gameState, isConnected, clientId: actualClientId } = useGameContext();
  const [displayClientId, setDisplayClientId] = useState<string>("");
  
  // Find the current player from game state
  const currentPlayer = gameState?.players?.find(p => p.id === gameState.currentPlayerId);
  
  // Get online players
  const onlinePlayers = gameState?.onlinePlayers || [];
  
  // Generate a shorter clientId for display
  useEffect(() => {
    if (actualClientId) {
      // Use the actual clientId but truncate it for display
      const shortened = actualClientId.substring(0, 8) + "...";
      setDisplayClientId(shortened);
    } else {
      // Fallback to random ID for display purposes
      const random = Math.random().toString(36).substring(2, 8);
      setDisplayClientId(random);
    }
  }, [actualClientId]);

  if (!isConnected) return null;
  
  // Check for the special isConnecting flag
  const isConnecting = Boolean((gameState as any)?.isConnecting);
  
  // If we're connecting or no currentPlayer is found but we're connected, show a connecting state
  if ((gameState as any)?.isConnecting || (!currentPlayer && isConnected)) {
    return (
      <Card className="overflow-hidden bg-white/50 backdrop-blur-sm border-amber-200">
        <CardHeader className="p-3 bg-gradient-to-r from-amber-50 to-amber-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-amber-800 flex items-center">
              <WifiIcon className="h-4 w-4 mr-1 text-amber-600" />
              Connecting
            </CardTitle>
            {gameState?.game?.code && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                {gameState.game.code}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-amber-700">
            Joining game...
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 text-xs">
          <div className="flex flex-col space-y-1">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-2 py-1">
                <div className="h-2 bg-amber-100 rounded"></div>
                <div className="h-2 bg-amber-100 rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Safety check - currentPlayer should be defined at this point
  if (!currentPlayer) return null;

  return (
    <Card className="overflow-hidden bg-white/50 backdrop-blur-sm border-green-200">
      <CardHeader className="p-3 bg-gradient-to-r from-green-50 to-green-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-green-800 flex items-center">
            <WifiIcon className="h-4 w-4 mr-1 text-green-600" />
            Connected
          </CardTitle>
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
            {gameState?.game?.code || ""}
          </Badge>
        </div>
        <CardDescription className="text-xs text-green-700">
          {isConnected ? 
            `Active connection (${onlinePlayers.length} player${onlinePlayers.length !== 1 ? 's' : ''} online)` : 
            "Connecting..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <div className="flex flex-col space-y-1">
          {/* Current player info */}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600 flex items-center">
              {currentPlayer?.isHost ? (
                <CrownIcon className="h-3 w-3 mr-1 text-amber-500" />
              ) : (
                <UserIcon className="h-3 w-3 mr-1" />
              )}
              {currentPlayer?.isHost ? "Host:" : "Player:"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-gray-900">{currentPlayer.username}</span>
              {currentPlayer?.isHost && (
                <Badge className="text-[0.6rem] px-1 py-0 h-4 bg-amber-100 text-amber-800 hover:bg-amber-200">
                  HOST
                </Badge>
              )}
            </div>
          </div>
          
          {/* Connection info */}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Client ID:</span>
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 text-[0.65rem]">
              {displayClientId}
            </code>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Player ID:</span>
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 text-[0.65rem]">
              {currentPlayer.id}
            </code>
          </div>
          
          {/* Online players status */}
          {gameState?.players && gameState.players.length > 1 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="font-semibold text-gray-600 mb-1">Players Online:</div>
              <div className="flex flex-wrap gap-1">
                {gameState.players.map(player => {
                  const isOnline = onlinePlayers.includes(player.id);
                  return (
                    <Badge 
                      key={player.id}
                      variant="outline" 
                      className={`flex items-center gap-1 ${
                        isOnline ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      <CircleIcon className={`h-2 w-2 ${
                        isOnline ? 'text-green-500' : 'text-gray-300'
                      }`} />
                      {player.username}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}