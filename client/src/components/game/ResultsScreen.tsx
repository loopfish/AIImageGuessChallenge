import { Button } from "@/components/ui/button";
import { useGameContext } from "@/hooks/use-game";
import { GameMessageType } from "@shared/schema";
import WordMatch from "./WordMatch";
import { useToast } from "@/hooks/use-toast";

interface PlayerWithMatchedWords {
  id: number;
  username: string;
  matchedWords: string[];
  place: number;
  points: number;
}

export default function ResultsScreen() {
  const { gameState, socket } = useGameContext();
  const { toast } = useToast();
  
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
  
  if (firstPlace && firstPlaceGuess) {
    playerResults.push({
      id: firstPlace.id,
      username: firstPlace.username,
      matchedWords: firstPlaceGuess.matchedWords || [],
      place: 1,
      points: 3
    });
  }
  
  if (secondPlace && secondPlaceGuess) {
    playerResults.push({
      id: secondPlace.id,
      username: secondPlace.username,
      matchedWords: secondPlaceGuess.matchedWords || [],
      place: 2,
      points: 2
    });
  }
  
  if (thirdPlace && thirdPlaceGuess) {
    playerResults.push({
      id: thirdPlace.id,
      username: thirdPlace.username,
      matchedWords: thirdPlaceGuess.matchedWords || [],
      place: 3,
      points: 1
    });
  }
  
  // Sort players by score for standings
  const standings = [...players].sort((a, b) => b.score - a.score);
  
  const handleNextRound = () => {
    if (!socket) {
      toast({
        title: "Connection error",
        description: "Not connected to the game server",
        variant: "destructive"
      });
      return;
    }
    
    // Check if we've reached the final round
    if (game.currentRound >= game.totalRounds) {
      // End the game
      socket.send(JSON.stringify({
        type: GameMessageType.END_GAME,
        payload: {
          gameId: game.id
        }
      }));
    } else {
      // Ask for prompt input for the next round
      const promptInput = window.prompt("Enter prompt for the next round:", "");
      if (promptInput && promptInput.trim()) {
        // Start next round
        socket.send(JSON.stringify({
          type: GameMessageType.NEXT_ROUND,
          payload: {
            gameId: game.id,
            prompt: promptInput
          }
        }));
      }
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
        
        <div className="p-6">
          {/* Winners Podium */}
          <div className="flex justify-center items-end space-x-4 my-8">
            {/* 2nd Place */}
            {secondPlace && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full border-4 border-secondary bg-white overflow-hidden flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
                    {secondPlace.username.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="bg-secondary h-24 w-24 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-8 h-8 flex items-center justify-center mb-1">
                    <span className="text-secondary font-bold">2</span>
                  </div>
                  <span className="text-white font-medium text-sm truncate w-full">{secondPlace.username}</span>
                  <span className="text-white text-xs">+2 pts</span>
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
                <div className="bg-primary h-32 w-32 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center mb-1">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <span className="text-white font-medium truncate w-full">{firstPlace.username}</span>
                  <span className="text-white text-sm">+3 pts</span>
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
                <div className="bg-accent h-20 w-20 rounded-t-lg flex flex-col items-center justify-center px-2">
                  <div className="bg-white rounded-full w-7 h-7 flex items-center justify-center mb-1">
                    <span className="text-accent font-bold">3</span>
                  </div>
                  <span className="text-white font-medium text-xs truncate w-full">{thirdPlace.username}</span>
                  <span className="text-white text-xs">+1 pt</span>
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
          
          {/* Button to Next Round */}
          {isHost && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleNextRound}
                className="px-6 py-3 transition-all duration-200 transform hover:scale-105"
              >
                {buttonText}
              </Button>
            </div>
          )}
          
          {!isHost && (
            <div className="text-center mt-8 text-gray-500">
              Waiting for the host to continue...
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
