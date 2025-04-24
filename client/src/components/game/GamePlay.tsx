import React, { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameContext } from "@/hooks/use-game";
import Timer from "./Timer";
import PlayerList from "./PlayerList";
import WordMatch from "./WordMatch";
import PlayerGuesses from "./PlayerGuesses";
import { PlayerConnectionInfo } from "./PlayerConnectionInfo";
import { GameMessageType } from "@shared/schema";

export default function GamePlay() {
  const { gameState, socket } = useGameContext();
  const { toast } = useToast();
  const [guess, setGuess] = useState("");
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  
  const currentRound = gameState?.currentRound;
  const currentPlayer = gameState?.players?.find(p => p.id === gameState.currentPlayerId);
  
  // Keep track of which words the current player has matched
  const playerGuesses = gameState?.playerGuesses?.filter(g => g.playerId === currentPlayer?.id) || [];
  
  // Extract all matched words from player's guesses
  const allMatchedWords = playerGuesses.flatMap(g => g.matchedWords || []);
  
  const handleSubmitGuess = (e: FormEvent) => {
    e.preventDefault();
    
    if (!guess.trim()) {
      toast({
        title: "Empty guess",
        description: "Please enter your guess first",
        variant: "destructive"
      });
      return;
    }
    
    if (!socket || !gameState?.game || !currentRound || !currentPlayer) {
      toast({
        title: "Error",
        description: "Connection error or game not properly loaded",
        variant: "destructive"
      });
      return;
    }
    
    // Send the guess to the server
    // We don't need to explicitly include clientId as the server will add it automatically
    // But we're sending it anyway for redundancy
    socket.send(JSON.stringify({
      type: GameMessageType.SUBMIT_GUESS,
      payload: {
        gameId: gameState.game.id,
        playerId: currentPlayer.id,
        roundId: currentRound.id,
        guessText: guess
      }
    }));
    
    // Clear the input
    setGuess("");
  };
  
  return (
    <div className="game-play">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column (Narrow) - Game Status & Players */}
        <div className="lg:col-span-1 space-y-6">
          {/* Round Info */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-heading font-semibold text-neutral-dark">
                Round {gameState?.game?.currentRound}/{gameState?.game?.totalRounds}
              </h3>
              
              {/* Timer Component */}
              <Timer timeRemaining={gameState?.timeRemaining || 0} />
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Game Code:</span>
                <span className="font-medium">{gameState?.game?.code}</span>
              </div>
              <div className="flex justify-between">
                <span>Players:</span>
                <span className="font-medium">{gameState?.players?.length || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Players List with Scores */}
          <PlayerList showScores={true} />
        </div>
        
        {/* Main Game Content Area */}
        <div className="lg:col-span-3">
          {/* Game Image & Guess Input */}
          <Card className="overflow-hidden">
            {/* AI Generated Image */}
            <div className="flex items-center justify-center bg-gray-100 p-4 min-h-[300px] md:min-h-[400px]">
              {currentRound?.imageUrl ? (
                <img 
                  className="max-h-[400px] max-w-full object-contain rounded" 
                  src={currentRound.imageUrl} 
                  alt="AI-generated image to guess" 
                />
              ) : (
                <div className="text-gray-400">No image available</div>
              )}
            </div>
            
            {/* User Guess Input */}
            <CardContent className="p-6 space-y-4">
              <h3 className="text-xl font-heading font-medium text-neutral-dark mb-1">Guess the Prompt</h3>
              <p className="text-gray-600 text-sm">Try to match as many words from the original prompt as possible.</p>
              
              <form onSubmit={handleSubmitGuess} className="mt-1 space-y-2">
                <Textarea
                  name="guess"
                  id="guess"
                  placeholder="Enter your guess..."
                  value={guess}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGuess(e.target.value)}
                  className="min-h-[80px] resize-y"
                />
                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    className="px-6"
                  >
                    Submit Guess
                  </Button>
                </div>
              </form>
              
              {/* Only show matched words at the end of the round */}
              {allMatchedWords.length > 0 && (
                <div className="mt-4">
                  {gameState?.game?.status === "round_end" ? (
                    <>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        Your Matched Words:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(allMatchedWords)).map((word, index) => (
                          <WordMatch key={index} word={word} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <h4 className="text-sm font-medium text-gray-500">
                      <span className="inline-flex items-center justify-center bg-purple-100 text-purple-800 rounded-full px-2 py-1 text-xs font-medium">
                        {allMatchedWords.length} {allMatchedWords.length === 1 ? 'word' : 'words'} matched
                      </span>
                      <span className="ml-2">Words will be revealed at the end of the round</span>
                    </h4>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Player Guesses */}
          <div className="mt-6">
            <PlayerGuesses />
          </div>
        </div>
      </div>
    </div>
  );
}
