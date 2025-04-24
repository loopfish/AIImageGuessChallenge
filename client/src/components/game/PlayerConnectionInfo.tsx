import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameContext } from "@/hooks/use-game";
import { UserIcon, WifiIcon, CrownIcon, CircleIcon, UsersIcon } from "lucide-react";

interface PlayerConnectionInfoProps {
  compact?: boolean;
}

/**
 * Component that displays the current player's connection information
 * and shows which players are currently online
 * Now supports a compact mode for smaller display in top-right corner
 */
export function PlayerConnectionInfo({ compact = false }: PlayerConnectionInfoProps) {
  const { gameState, isConnected } = useGameContext();
  
  // Find the current player from game state
  const currentPlayer = gameState?.players?.find(p => p.id === gameState.currentPlayerId);
  
  // Get online players
  const onlinePlayers = gameState?.onlinePlayers || [];

  // Log component rendering for debugging
  console.log("PlayerConnectionInfo component rendering:", {
    gameState,
    currentPlayer,
    isConnected,
    onlinePlayers,
    compact
  });
  
  // Check for the special isConnecting flag or if we don't have player data yet
  const isConnecting = Boolean(gameState?.isConnecting) || (!currentPlayer && isConnected);
  
  // If we're not connected at all, show a disconnected state
  if (!isConnected) {
    return (
      <Card className={`overflow-hidden bg-white/80 backdrop-blur-sm border-red-200 shadow-md ${compact ? 'shadow-lg' : ''}`}>
        <CardHeader className={`${compact ? 'p-2' : 'p-3'} bg-gradient-to-r from-red-50 to-red-100`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center">
              <WifiIcon className="h-4 w-4 mr-1 text-red-600" />
              Disconnected
            </CardTitle>
          </div>
          {!compact && (
            <CardDescription className="text-xs text-red-700">
              Not connected to game server
            </CardDescription>
          )}
        </CardHeader>
        {!compact && (
          <CardContent className="p-3 text-xs">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center text-red-600">
                <CircleIcon className="h-2 w-2 mr-1" />
                <span>Waiting for connection...</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }
  
  // If we're connecting or no currentPlayer is found but we're connected, show a connecting state
  if (isConnecting) {
    return (
      <Card className={`overflow-hidden bg-white/80 backdrop-blur-sm border-amber-200 shadow-md ${compact ? 'shadow-lg' : ''}`}>
        <CardHeader className={`${compact ? 'p-2' : 'p-3'} bg-gradient-to-r from-amber-50 to-amber-100`}>
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
          {!compact && (
            <CardDescription className="text-xs text-amber-700">
              Joining game...
            </CardDescription>
          )}
        </CardHeader>
        {!compact && (
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
        )}
      </Card>
    );
  }

  // Safety check - currentPlayer should be defined at this point,
  // but if not, show a fallback view
  if (!currentPlayer) {
    return (
      <Card className={`overflow-hidden bg-white/80 backdrop-blur-sm border-blue-200 shadow-md ${compact ? 'shadow-lg' : ''}`}>
        <CardHeader className={`${compact ? 'p-2' : 'p-3'} bg-gradient-to-r from-blue-50 to-blue-100`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center">
              <WifiIcon className="h-4 w-4 mr-1 text-blue-600" />
              Connected
            </CardTitle>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
              {gameState?.game?.code || ""}
            </Badge>
          </div>
          {!compact && (
            <CardDescription className="text-xs text-blue-700">
              Connected to game server
            </CardDescription>
          )}
        </CardHeader>
        {!compact && (
          <CardContent className="p-3 text-xs">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center text-blue-600">
                <CircleIcon className="h-2 w-2 mr-1" />
                <span>Waiting for player data...</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // Compact mode - minimal info
  if (compact) {
    return (
      <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-green-200 shadow-lg">
        <CardHeader className="p-2 bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center">
              <WifiIcon className="h-3 w-3 mr-1 text-green-600" />
              <span className="truncate">
                {currentPlayer.username}
                {currentPlayer.isHost && <CrownIcon className="inline h-3 w-3 ml-1 text-amber-500" />}
              </span>
            </CardTitle>
            <div className="flex items-center gap-1">
              <UsersIcon className="h-3 w-3 text-gray-500" />
              <span className="text-xs">{onlinePlayers.length}/{gameState?.players?.length || 0}</span>
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-green-100 text-green-800">
                {gameState?.game?.code || ""}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Regular connected view with player info (full mode)
  return (
    <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-green-200 shadow-md">
      <CardHeader className="p-3 bg-gradient-to-r from-green-50 to-green-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center">
              <WifiIcon className="h-4 w-4 mr-1 text-green-600" />
              Game Lobby
            </CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
              {gameState?.game?.code || ""}
            </Badge>
          </div>
          <CardDescription className="text-xs text-green-700 m-0">
            {isConnected ? 
              `${onlinePlayers.length} player${onlinePlayers.length !== 1 ? 's' : ''} online` : 
              "Connecting..."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {currentPlayer?.isHost ? (
                <div className="flex items-center bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                  <CrownIcon className="h-4 w-4 text-amber-500 mr-1" />
                  <span className="text-sm font-medium text-amber-700">Host: {currentPlayer.username}</span>
                </div>
              ) : (
                <div className="flex items-center bg-blue-50 border border-blue-200 rounded-full px-2 py-1">
                  <UserIcon className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-sm font-medium text-blue-700">Player: {currentPlayer.username}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Online players status */}
          {gameState?.players && gameState?.players.length > 0 && (
            <div className="flex items-center">
              <div className="font-medium text-sm text-gray-600 mr-2">Players:</div>
              <div className="flex gap-1">
                {gameState?.players?.map(player => {
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
                      {player.isHost && <CrownIcon className="h-3 w-3 ml-1 text-amber-500" />}
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