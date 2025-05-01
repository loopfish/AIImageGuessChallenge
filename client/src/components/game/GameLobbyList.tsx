import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GameMessageType } from "@shared/schema";
import { useGameContext } from "@/hooks/use-game";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Type for the API response from /api/games
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

interface GameLobbyListProps {
  username: string;
  onJoinGame: (gameCode: string) => void;
}

export function GameLobbyList({ username, onJoinGame }: GameLobbyListProps) {
  const { toast } = useToast();
  const { socket } = useGameContext();
  const [selectedGame, setSelectedGame] = useState<GameLobby | null>(null);
  const [password, setPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  
  // Query for fetching active game lobbies
  const { data: lobbies, isLoading, error, refetch } = useQuery<GameLobby[]>({
    queryKey: ['/api/games'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Handle joining a password-protected game
  const handleJoinProtectedGame = () => {
    if (!selectedGame) return;
    
    setIsJoining(true);
    
    // Join the game with password via WebSocket
    if (socket) {
      socket.send(JSON.stringify({
        type: GameMessageType.JOIN_GAME,
        payload: {
          username,
          gameCode: selectedGame.code,
          password
        }
      }));
      
      // Close the dialog
      setSelectedGame(null);
      setPassword("");
      
      // Callback to parent component
      onJoinGame(selectedGame.code);
    } else {
      toast({
        title: "Connection error",
        description: "Unable to connect to game server",
        variant: "destructive"
      });
    }
    
    setIsJoining(false);
  };
  
  // Handle joining a game directly (no password)
  const handleJoinGame = (game: GameLobby) => {
    if (game.hasPassword) {
      setSelectedGame(game);
      return;
    }
    
    setIsJoining(true);
    
    // Join the game via WebSocket
    if (socket) {
      socket.send(JSON.stringify({
        type: GameMessageType.JOIN_GAME,
        payload: {
          username,
          gameCode: game.code,
        }
      }));
      
      // Callback to parent component
      onJoinGame(game.code);
    } else {
      toast({
        title: "Connection error",
        description: "Unable to connect to game server",
        variant: "destructive"
      });
    }
    
    setIsJoining(false);
  };
  
  // Format the created time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading available games...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center">
        <p className="text-red-500 mb-2">Failed to load available games</p>
        <Button onClick={() => refetch()} variant="outline">Try Again</Button>
      </div>
    );
  }

  if (!lobbies || lobbies.length === 0) {
    return (
      <div className="py-6 text-center border rounded-lg bg-gray-50">
        <p className="text-gray-500 mb-3">No active games found</p>
        <p className="text-sm text-gray-400 mb-4">Create a new game or check back later</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Available Games</h3>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {lobbies.map(game => (
          <Card key={game.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-base">
                    {game.roomName || `Game #${game.id}`}
                    {game.hasPassword && <Lock className="h-4 w-4 ml-1 inline text-amber-500" />}
                  </h4>
                  <p className="text-sm text-gray-500">Code: {game.code}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {game.totalRounds} rounds
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-4 w-4 mr-1" />
                <span>Wait time: {game.timerSeconds}s</span>
                <span className="mx-2">•</span>
                <span>Created at {formatTime(game.createdAt)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handleJoinGame(game)}
                disabled={isJoining}
              >
                {isJoining ? 'Joining...' : 'Join Game'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {/* Password dialog for protected rooms */}
      <Dialog open={!!selectedGame} onOpenChange={(open) => !open && setSelectedGame(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Room Password</DialogTitle>
            <DialogDescription>
              This room is password protected. Please enter the password to join.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="room-password">Password</Label>
            <Input
              id="room-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter room password"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGame(null)}>
              Cancel
            </Button>
            <Button onClick={handleJoinProtectedGame} disabled={!password || isJoining}>
              {isJoining ? 'Joining...' : 'Join Game'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}