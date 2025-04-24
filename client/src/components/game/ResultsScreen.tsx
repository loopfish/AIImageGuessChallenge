import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, Zap } from "lucide-react";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import WordMatch from "./WordMatch";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInSeconds } from "date-fns";
import avatarImage from "../../assets/avatar.webp";

interface PlayerWithMatchedWords {
  id: number;
  username: string;
  matchedWords: string[];
  place: number;
  points: number;
  submittedAt?: Date; // Submission timestamp
  submissionSpeed?: number; // Submission speed in seconds
}

export default function ResultsScreen() {
  const { gameState, socket } = useGameContext();
  const { toast } = useToast();
  const [nextPrompt, setNextPrompt] = useState("");
  
  if (!gameState?.game || !gameState.currentRound || !gameState.roundResults) {
    return <div>Loading results...</div>;
  }
  
  // Determine if current player is the host
  const isHost = gameState.players?.some(p => {
    if (p.isHost && p.id === gameState.currentPlayerId) {
      console.log("Current player is the host", p);
      return true;
    }
    return false;
  });
  
  console.log("Current player ID:", gameState.currentPlayerId);
  console.log("Is host:", isHost);
  
  const game = gameState.game;
  const currentRound = gameState.currentRound;
  const roundResults = gameState.roundResults;
  const players = gameState.players || [];
  
  // Get winner data
  const firstPlace = roundResults.firstPlaceId 
    ? players.find(p => p.id === roundResults.firstPlaceId)
    : undefined;
    
  const secondPlace = roundResults.secondPlaceId 
    ? players.find(p => p.id === roundResults.secondPlaceId)
    : undefined;
    
  const thirdPlace = roundResults.thirdPlaceId 
    ? players.find(p => p.id === roundResults.thirdPlaceId)
    : undefined;
  
  // Find player guesses with matched words
  const playerGuesses = gameState.playerGuesses || [];
  
  const firstPlaceGuess = firstPlace
    ? playerGuesses.find(g => g.playerId === firstPlace.id)
    : undefined;
    
  const secondPlaceGuess = secondPlace
    ? playerGuesses.find(g => g.playerId === secondPlace.id)
    : undefined;
    
  const thirdPlaceGuess = thirdPlace
    ? playerGuesses.find(g => g.playerId === thirdPlace.id)
    : undefined;
  
  // Player results to display
  const playerResults: PlayerWithMatchedWords[] = [];
  
  // Calculate submission times relative to round start
  // Assume the round start time is the time when the round was started (or now if not available)
  const roundStartTime = currentRound.startTime ? new Date(currentRound.startTime) : new Date();
  
  // Add submission speed to guess objects for display in podium
  // This is safe to do as we're not modifying the original objects in the gameState
  const processedGuesses = {
    firstPlaceGuess: firstPlaceGuess ? {
      ...firstPlaceGuess,
      submissionSpeed: firstPlaceGuess.submittedAt ? 
        differenceInSeconds(new Date(firstPlaceGuess.submittedAt), roundStartTime) : undefined
    } : undefined,
    
    secondPlaceGuess: secondPlaceGuess ? {
      ...secondPlaceGuess,
      submissionSpeed: secondPlaceGuess.submittedAt ? 
        differenceInSeconds(new Date(secondPlaceGuess.submittedAt), roundStartTime) : undefined
    } : undefined,
    
    thirdPlaceGuess: thirdPlaceGuess ? {
      ...thirdPlaceGuess,
      submissionSpeed: thirdPlaceGuess.submittedAt ? 
        differenceInSeconds(new Date(thirdPlaceGuess.submittedAt), roundStartTime) : undefined
    } : undefined
  };
  
  if (firstPlace && processedGuesses.firstPlaceGuess) {
    const submittedAt = processedGuesses.firstPlaceGuess.submittedAt ? 
      new Date(processedGuesses.firstPlaceGuess.submittedAt) : undefined;
    
    playerResults.push({
      id: firstPlace.id,
      username: firstPlace.username,
      matchedWords: processedGuesses.firstPlaceGuess.matchedWords || [],
      place: 1,
      points: 3,
      submittedAt,
      submissionSpeed: processedGuesses.firstPlaceGuess.submissionSpeed
    });
  }
  
  if (secondPlace && processedGuesses.secondPlaceGuess) {
    const submittedAt = processedGuesses.secondPlaceGuess.submittedAt ? 
      new Date(processedGuesses.secondPlaceGuess.submittedAt) : undefined;
    
    playerResults.push({
      id: secondPlace.id,
      username: secondPlace.username,
      matchedWords: processedGuesses.secondPlaceGuess.matchedWords || [],
      place: 2,
      points: 2,
      submittedAt,
      submissionSpeed: processedGuesses.secondPlaceGuess.submissionSpeed
    });
  }
  
  if (thirdPlace && processedGuesses.thirdPlaceGuess) {
    const submittedAt = processedGuesses.thirdPlaceGuess.submittedAt ? 
      new Date(processedGuesses.thirdPlaceGuess.submittedAt) : undefined;
    
    playerResults.push({
      id: thirdPlace.id,
      username: thirdPlace.username,
      matchedWords: processedGuesses.thirdPlaceGuess.matchedWords || [],
      place: 3,
      points: 1,
      submittedAt,
      submissionSpeed: processedGuesses.thirdPlaceGuess.submissionSpeed
    });
  }
  
  // Sort players by score for standings
  const standings = [...players].sort((a, b) => b.score - a.score);
  
  const [isStartingNextRound, setIsStartingNextRound] = useState(false);
  
  const handleNextRound = () => {
    console.log("Next round button clicked");
    
    if (!socket) {
      console.error("No socket connection available");
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive"
      });
      return;
    }
    
    console.log(`Game object:`, game);
    console.log(`Current round: ${game.currentRound}, Total rounds: ${game.totalRounds}`);
    
    try {
      // Check if we've reached the final round
      if (game.currentRound >= game.totalRounds) {
        console.log("Final round reached, ending game");
        // End the game
        setIsStartingNextRound(true);
        const endGameMessage = JSON.stringify({
          type: GameMessageType.END_GAME,
          payload: {
            gameId: game.id
          }
        });
        console.log("Sending end game message:", endGameMessage);
        socket.send(endGameMessage);
      } else {
        console.log("Using prompt from input field:", nextPrompt);
        
        if (!nextPrompt.trim()) {
          toast({
            title: "Empty prompt",
            description: "Please enter a prompt for the next round",
            variant: "destructive"
          });
          return;
        }
        
        try {
          // Show loading state
          setIsStartingNextRound(true);
          
          // Start next round
          const nextRoundMessage = JSON.stringify({
            type: GameMessageType.NEXT_ROUND,
            payload: {
              gameId: game.id,
              prompt: nextPrompt
            }
          });
          console.log("Sending next round message:", nextRoundMessage);
          socket.send(nextRoundMessage);
        } catch (error) {
          setIsStartingNextRound(false);
          console.error("Error sending next round message:", error);
          toast({
            title: "Error starting next round",
            description: "There was a problem starting the next round. Please try again.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      setIsStartingNextRound(false);
      console.error("Error in next round handler:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Determine button text based on current round
  const buttonText = game.currentRound >= game.totalRounds
    ? "End Game"
    : "Continue to Next Round";
  
  return (
    <div className="results-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-primary text-white p-6 text-center">
          <h2 className="text-3xl font-heading font-bold">Round Results</h2>
          <p className="text-primary-100 mt-1">The original prompt was:</p>
          <p className="text-xl mt-2 font-medium">"{currentRound.prompt}"</p>
        </div>
        
        <div className="p-6 pl-36">
          {/* Winners Podium */}
          <div className="relative flex justify-center items-end space-x-4 my-8">
            {/* Avatar image to the left of podium */}
            <div className="absolute left-0 bottom-0 transform -translate-x-24">
              <div className="relative">
                <img 
                  src={avatarImage} 
                  alt="Presenter avatar" 
                  className="w-28 h-28 object-cover rounded-full border-2 border-gray-200 shadow-lg"
                />
                {/* Speech bubble pointing to podium */}
                <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 translate-x-full">
                  <div className="relative bg-white p-2 rounded-lg shadow-md">
                    <div className="absolute left-0 top-1/2 transform -translate-x-2 -translate-y-1/2 rotate-45 w-4 h-4 bg-white"></div>
                    <p className="text-xs font-medium relative z-10 px-1">Congratulations!</p>
                  </div>
                </div>
              </div>
            </div>
            {/* 2nd Place */}
            {secondPlace && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full border-4 border-secondary bg-white overflow-hidden flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
                    {secondPlace.username.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="bg-secondary h-28 w-24 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-8 h-8 flex items-center justify-center mb-1">
                    <span className="text-secondary font-bold">2</span>
                  </div>
                  <span className="text-white font-medium text-sm truncate w-full">{secondPlace.username}</span>
                  <span className="text-white text-xs">+2 pts</span>
                  {processedGuesses.secondPlaceGuess?.submissionSpeed !== undefined && (
                    <span className="text-white/80 text-[0.6rem] mt-1 flex items-center justify-center">
                      <Zap className="h-3 w-3 mr-1" />
                      {processedGuesses.secondPlaceGuess.submissionSpeed} {processedGuesses.secondPlaceGuess.submissionSpeed === 1 ? 'sec' : 'secs'}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* 1st Place */}
            {firstPlace && (
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-3 rounded-full border-4 border-primary bg-white overflow-hidden flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-secondary text-white flex items-center justify-center text-2xl font-bold">
                    {firstPlace.username.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="bg-primary h-36 w-32 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center mb-1">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <span className="text-white font-medium truncate w-full">{firstPlace.username}</span>
                  <span className="text-white text-sm">+3 pts</span>
                  {processedGuesses.firstPlaceGuess?.submissionSpeed !== undefined && (
                    <span className="text-white/80 text-[0.65rem] mt-1 flex items-center justify-center">
                      <Zap className="h-3 w-3 mr-1" />
                      {processedGuesses.firstPlaceGuess.submissionSpeed} {processedGuesses.firstPlaceGuess.submissionSpeed === 1 ? 'sec' : 'secs'}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* 3rd Place */}
            {thirdPlace && (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full border-4 border-accent bg-white overflow-hidden flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center text-lg font-bold">
                    {thirdPlace.username.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="bg-accent h-24 w-20 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-7 h-7 flex items-center justify-center mb-1">
                    <span className="text-accent font-bold">3</span>
                  </div>
                  <span className="text-white font-medium text-xs truncate w-full">{thirdPlace.username}</span>
                  <span className="text-white text-xs">+1 pt</span>
                  {processedGuesses.thirdPlaceGuess?.submissionSpeed !== undefined && (
                    <span className="text-white/80 text-[0.6rem] mt-1 flex items-center justify-center">
                      <Zap className="h-3 w-3 mr-1" />
                      {processedGuesses.thirdPlaceGuess.submissionSpeed} {processedGuesses.thirdPlaceGuess.submissionSpeed === 1 ? 'sec' : 'secs'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Matched Words Summary */}
          {playerResults.length > 0 && (
            <div className="border rounded-lg p-4 my-6">
              <h3 className="text-lg font-heading font-medium text-neutral-dark mb-3">Word Matching Summary</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {playerResults.map((result, index) => (
                  <div className="border rounded p-3" key={index}>
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-medium">
                        {result.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="ml-2 font-medium">{result.username}</span>
                      <span className="ml-auto text-sm bg-primary text-white px-2 py-1 rounded-full">
                        {result.matchedWords.length} words
                      </span>
                    </div>
                    
                    {/* Speed of submission */}
                    {result.submissionSpeed !== undefined && (
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Zap className="h-3 w-3 mr-1" /> 
                        <span>Response time: {result.submissionSpeed} {result.submissionSpeed === 1 ? 'second' : 'seconds'}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {result.matchedWords.map((word, wordIndex) => (
                        <WordMatch key={wordIndex} word={word} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Current Standings */}
          <div className="mt-8">
            <h3 className="text-lg font-heading font-medium text-neutral-dark mb-3">Current Game Standings</h3>
            
            <div className="overflow-hidden border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {standings.map((player, index) => (
                    <tr key={player.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-dark">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full ${getAvatarColor(index)} text-white flex items-center justify-center font-medium`}>
                            {player.username.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="ml-2">{player.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{player.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Host Next Round Controls */}
          {isHost && game.currentRound < game.totalRounds && (
            <Card className="mt-8 border-primary/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-heading font-medium text-neutral-dark mb-2">
                  Enter Prompt for Next Round
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create a descriptive prompt for the AI to generate an image for the next round.
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="next-prompt">Image Prompt</Label>
                    <Textarea
                      id="next-prompt"
                      placeholder="e.g., 'A serene mountain lake at sunset with pine trees and snow-capped peaks'"
                      value={nextPrompt}
                      onChange={(e) => setNextPrompt(e.target.value)}
                      className="min-h-[100px]"
                      disabled={isStartingNextRound}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      onClick={handleNextRound}
                      className="px-6"
                      disabled={isStartingNextRound || !nextPrompt.trim()}
                    >
                      {isStartingNextRound ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting Next Round...
                        </>
                      ) : (
                        "Start Next Round"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* End Game Button (Final Round) */}
          {isHost && game.currentRound >= game.totalRounds && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleNextRound}
                className="px-6 py-3 bg-accent hover:bg-accent/90 transition-all duration-200"
                disabled={isStartingNextRound}
              >
                {isStartingNextRound ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ending Game...
                  </>
                ) : (
                  "End Game"
                )}
              </Button>
            </div>
          )}
          
          {/* Non-host waiting message */}
          {!isHost && (
            <div className="text-center p-6 mt-8 border rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Waiting for Host</h3>
              <p className="text-gray-500">
                The game host will start the next round shortly...
              </p>
            </div>
          )}
        </div>
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
