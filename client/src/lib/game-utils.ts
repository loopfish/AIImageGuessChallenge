/**
 * Utilities for the Prompt Guesser game
 */

import { Guess, Player } from "@shared/schema";
import { IStorage } from "../../server/storage";

/**
 * Generate a random alphanumeric game code
 */
export function generateGameCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding easily confused characters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Match words between the original prompt and a guess
 * 
 * @param prompt The original prompt text
 * @param guess The player's guess text
 * @returns Array of matched words
 */
export function matchWords(prompt: string, guess: string): string[] {
  // Normalize strings - convert to lowercase and remove punctuation
  const normalizeString = (str: string) => {
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .trim();
  };

  const normalizedPrompt = normalizeString(prompt);
  const normalizedGuess = normalizeString(guess);

  // Split into words
  const promptWords = normalizedPrompt.split(' ');
  const guessWords = normalizedGuess.split(' ');

  // Find matching words
  const matches: string[] = [];

  // Create a copy of prompt words to track which ones have been matched
  const remainingPromptWords = [...promptWords];

  // Check each guess word against remaining prompt words
  guessWords.forEach(guessWord => {
    const index = remainingPromptWords.indexOf(guessWord);
    if (index !== -1) {
      matches.push(guessWord);
      // Remove the matched word to prevent duplicate matches
      remainingPromptWords.splice(index, 1);
    }
  });

  return matches;
}

/**
 * Calculate a score for a guess based on matched words and timing
 * 
 * @param guess The player's guess
 * @param promptWordCount The total number of words in the original prompt
 * @param roundStartTime The time when the round started
 * @returns A score value
 */
export function calculateGuessScore(
  guess: Guess,
  promptWordCount: number,
  roundStartTime: Date
): number {
  // Base score from number of matched words
  const matchRatio = guess.matchCount / promptWordCount;
  let score = matchRatio * 100; // Base 100 points for perfect match
  
  // Time bonus - decrease score based on how long it took to guess
  const submissionTime = new Date(guess.submittedAt);
  const secondsElapsed = (submissionTime.getTime() - roundStartTime.getTime()) / 1000;
  
  // Time decay factor - lose points the longer it takes to answer
  // Example: lose up to 50% of points over 60 seconds
  const timeDecay = Math.min(1, secondsElapsed / 60) * 0.5;
  
  // Apply time decay to score
  score = score * (1 - timeDecay);
  
  return Math.round(score);
}

/**
 * Determine the 1st, 2nd, and 3rd place winners for a round
 */
export async function determineRoundWinners(
  round: any,
  guesses: Guess[],
  players: Player[],
  storage: IStorage
) {
  // No winners if no guesses
  if (!guesses.length) {
    return {
      firstPlace: undefined,
      secondPlace: undefined,
      thirdPlace: undefined
    };
  }
  
  // The round start time
  const roundStartTime = round.startTime ? new Date(round.startTime) : new Date();
  
  // Calculate prompt word count
  const promptWordCount = round.prompt.split(/\s+/).length;
  
  // Calculate a score for each guess
  const scoredGuesses = guesses.map(guess => {
    const score = calculateGuessScore(guess, promptWordCount, roundStartTime);
    return {
      guess,
      score,
      player: players.find(p => p.id === guess.playerId)
    };
  });
  
  // Group by player and take highest score for each
  const playerBestScores = new Map<number, typeof scoredGuesses[0]>();
  
  scoredGuesses.forEach(scoredGuess => {
    if (!scoredGuess.player) return;
    
    const playerId = scoredGuess.player.id;
    const currentBest = playerBestScores.get(playerId);
    
    if (!currentBest || scoredGuess.score > currentBest.score) {
      playerBestScores.set(playerId, scoredGuess);
    }
  });
  
  // Sort players by score (highest first)
  const sortedScores = Array.from(playerBestScores.values())
    .sort((a, b) => b.score - a.score);
  
  // Get top 3 players
  const firstPlace = sortedScores[0]?.player;
  const secondPlace = sortedScores[1]?.player;
  const thirdPlace = sortedScores[2]?.player;
  
  return {
    firstPlace,
    secondPlace,
    thirdPlace
  };
}
