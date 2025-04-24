import React, { useState, useEffect, FormEvent } from "react";
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
import { CrownIcon } from "lucide-react";

export default function GamePlay() {
  const { gameState, socket, clientId } = useGameContext();
  const { toast } = useToast();
  const [guess, setGuess] = useState("");
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  const currentRound = gameState?.currentRound;
  const currentPlayer = gameState?.players?.find(p => p.id === gameState.currentPlayerId);
  
  // Determine if current player is the host
  const isHost = currentPlayer?.isHost || false;
  
  // Check if player has already submitted a guess for the current round
  const currentRoundGuesses = gameState?.playerGuesses?.filter(
    g => g.playerId === currentPlayer?.id && g.roundId === currentRound?.id
  ) || [];
  const hasAlreadyGuessed = currentRoundGuesses.length > 0;
  
  // Update hasSubmitted state if we detect server-side submissions
  useEffect(() => {
    if (hasAlreadyGuessed && !hasSubmitted) {
      setHasSubmitted(true);
    }
  }, [hasAlreadyGuessed]);
  
  // Check if player is allowed to guess
  // Hosts cannot submit guesses in their own games to prevent cheating
  // Players can't guess if they've already submitted a guess
  const canSubmitGuess = (!isHost && !hasSubmitted) || gameState?.game?.status === "round_end";
  
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
    
    // Check if player has already submitted a guess for this round
    const existingGuesses = gameState.playerGuesses?.filter(
      g => g.playerId === currentPlayer.id && g.roundId === currentRound.id
    ) || [];
    
    if (existingGuesses.length > 0) {
      toast({
        title: "One Guess Per Round",
        description: "You've already submitted a guess for this round",
        variant: "destructive"
      });
      return;
    }
    
    console.log(`Submitting guess as ${currentPlayer.username} (ID: ${currentPlayer.id}, Client ID: ${clientId})`);
    
    // Send the guess to the server with explicit player identification information
    // Make sure we include ALL possible identification data to prevent misattribution
    socket.send(JSON.stringify({
      type: GameMessageType.SUBMIT_GUESS,
      clientId: clientId, // Include client ID in the root of the message
      payload: {
        gameId: gameState.game.id,
        playerId: currentPlayer.id,
        roundId: currentRound.id,
        guessText: guess,
        username: currentPlayer.username, // Include username for extra validation
        gameCode: gameState.game.code, // Include game code for context
        clientId: clientId // Also include in payload for backward compatibility
      }
    }));
    
    // Clear the input
    setGuess("");
    
    // Show toast notification
    toast({
      title: "Guess Submitted",
      description: "Your guess has been submitted successfully",
      variant: "default",
    });
    
    // Mark that the player has submitted a guess for this round
    setHasSubmitted(true);
  };
  
  // Log the game state for debugging
  console.log("GamePlay component rendering with state:", {
    gameState,
    currentPlayer,
    hasSubmitted,
    canSubmitGuess
  });

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
              
              {isHost ? (
                <div className="mt-6 mb-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
                  <h4 className="text-amber-800 font-medium flex items-center mb-1">
                    <CrownIcon className="h-4 w-4 mr-1 text-amber-500" />
                    Host Mode
                  </h4>
                  <p className="text-sm text-amber-700">
                    As the host, you cannot submit guesses for your own game to keep things fair.
                    You can still watch players' guesses and see their scores.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitGuess} className="mt-1 space-y-2">
                  <Textarea
                    name="guess"
                    id="guess"
                    placeholder={hasSubmitted ? "You've already submitted a guess for this round" : "Enter your guess..."}
                    value={guess}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGuess(e.target.value)}
                    className="min-h-[80px] resize-y"
                    disabled={!canSubmitGuess || hasSubmitted}
                  />
                  <div className="flex justify-end">
                    <Button 
                      type="submit"
                      className="px-6"
                      disabled={!canSubmitGuess || hasSubmitted}
                    >
                      {hasSubmitted ? "Guess Submitted" : "Submit Guess"}
                    </Button>
                  </div>
                </form>
              )}
              
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
                    <div className="p-2 bg-purple-50 border border-purple-100 rounded-md">
                      <h4 className="text-sm font-medium text-purple-700 flex items-center">
                        <span className="inline-flex items-center justify-center bg-purple-100 text-purple-800 rounded-full px-2 py-1 text-xs font-medium mr-2">
                          {allMatchedWords.length} {allMatchedWords.length === 1 ? 'word' : 'words'}
                        </span>
                        You've matched some words! Details will be revealed at the end of the round.
                      </h4>
                    </div>
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
