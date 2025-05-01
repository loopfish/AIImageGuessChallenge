import { useGameContext } from "@/hooks/use-game";
import { formatDistanceToNow } from "date-fns";
import WordMatch from "./WordMatch";

export default function PlayerGuesses() {
  const { gameState } = useGameContext();
  
  // Get player guesses sorted by most recent
  const guesses = gameState?.playerGuesses || [];
  const players = gameState?.players || [];
  
  // Sort guesses by submission time (most recent first)
  const sortedGuesses = [...guesses]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 10); // Show only the 10 most recent guesses
  
  if (sortedGuesses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-heading font-medium text-neutral-dark mb-4">
          Recent Guesses
        </h3>
        <p className="text-gray-500 text-center py-4">No guesses yet. Be the first to submit a guess!</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-heading font-medium text-neutral-dark mb-4">Recent Guesses</h3>
      
      <div className="space-y-3">
        {sortedGuesses.map((guess, index) => {
          // Find the player who made this guess
          const player = players.find(p => p.id === guess.playerId);
          if (!player) return null;
          
          // Format the time
          const timeAgo = formatDistanceToNow(new Date(guess.submittedAt), { addSuffix: true });
          
          // Split the guess text and highlight matched words
          const guessWords = guess.guessText.split(/\s+/);
          const matchedWords = guess.matchedWords || [];
          
          return (
            <div className="p-3 bg-gray-50 rounded-lg" key={index}>
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(index)} text-white flex items-center justify-center font-medium`}>
                  {player.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="ml-2 font-medium text-gray-700">{player.username}</span>
                <span className="ml-auto text-sm text-gray-500">{timeAgo}</span>
              </div>
              <p className="mt-2 ml-10 text-gray-700">
                {guessWords.map((word, wordIndex) => {
                  const isMatched = matchedWords.includes(word.toLowerCase());
                  
                  if (isMatched) {
                    return (
                      <span key={wordIndex}>
                        <span className="bg-primary/10 text-primary px-1 rounded">{word}</span>{' '}
                      </span>
                    );
                  }
                  
                  return <span key={wordIndex}>{word} </span>;
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to get avatar color
function getAvatarColor(index: number): string {
  const colors = [
    "bg-accent", 
    "bg-purple-500", 
    "bg-green-500", 
    "bg-orange-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-secondary"
  ];
  return colors[index % colors.length];
}
