import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameContext } from "@/hooks/use-game";
import { UserIcon, WifiIcon, CrownIcon } from "lucide-react";

/**
 * Component that displays the current player's connection information
 * This helps users verify they are properly logged in to the game
 */
export function PlayerConnectionInfo() {
  const { gameState, isConnected } = useGameContext();
  const [clientId, setClientId] = useState<string>("");
  
  // Find the current player from game state
  const currentPlayer = gameState?.players?.find(p => p.id === gameState.currentPlayerId);
  
  // Generate a clientId on component mount
  useEffect(() => {
    // Generate a pseudo-random client ID for display purposes
    // This is just for display and doesn't affect the actual clientId used by the server
    const displayClientId = Math.random().toString(36).substring(2, 8);
    setClientId(displayClientId);
  }, []);

  if (!isConnected || !currentPlayer) return null;

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
          {isConnected ? "Active connection to game server" : "Connecting..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <div className="flex flex-col space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600 flex items-center">
              {currentPlayer.isHost ? (
                <CrownIcon className="h-3 w-3 mr-1 text-amber-500" />
              ) : (
                <UserIcon className="h-3 w-3 mr-1" />
              )}
              {currentPlayer.isHost ? "Host:" : "Player:"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-gray-900">{currentPlayer.username}</span>
              {currentPlayer.isHost && (
                <Badge className="text-[0.6rem] px-1 py-0 h-4 bg-amber-100 text-amber-800 hover:bg-amber-200">
                  HOST
                </Badge>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Client ID:</span>
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 text-[0.65rem]">
              {clientId}
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">Player ID:</span>
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 text-[0.65rem]">
              {currentPlayer.id}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}