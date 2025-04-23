import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlayIcon, Crown, Timer, Users, Image, MessageSquare } from "lucide-react";

export default function HowToPlay() {
  return (
    <div className="max-w-4xl mx-auto fadeInUp">
      <Card className="mb-8">
        <CardHeader>
          <h1 className="text-3xl font-heading font-bold text-center">How to Play Prompt Guesser</h1>
        </CardHeader>
        <CardContent className="space-y-8">
          <p className="text-lg text-center text-gray-700">
            Prompt Guesser is a fun multiplayer game where players try to guess the prompt that was used to create an AI-generated image.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary/5 p-6 rounded-lg flex flex-col items-center text-center">
              <Users className="h-12 w-12 text-primary mb-3" />
              <h2 className="text-xl font-heading font-semibold mb-2">Create or Join a Game</h2>
              <p className="text-gray-600">
                Host a new game and invite friends with your game code, or join an existing game using a code from a friend.
              </p>
            </div>
            
            <div className="bg-primary/5 p-6 rounded-lg flex flex-col items-center text-center">
              <Image className="h-12 w-12 text-primary mb-3" />
              <h2 className="text-xl font-heading font-semibold mb-2">Generate an AI Image</h2>
              <p className="text-gray-600">
                As the host, enter a prompt to generate an AI image that players will try to guess.
              </p>
            </div>
            
            <div className="bg-primary/5 p-6 rounded-lg flex flex-col items-center text-center">
              <MessageSquare className="h-12 w-12 text-primary mb-3" />
              <h2 className="text-xl font-heading font-semibold mb-2">Guess the Prompt</h2>
              <p className="text-gray-600">
                Players submit their guesses, trying to match as many words from the original prompt as possible.
              </p>
            </div>
            
            <div className="bg-primary/5 p-6 rounded-lg flex flex-col items-center text-center">
              <Crown className="h-12 w-12 text-primary mb-3" />
              <h2 className="text-xl font-heading font-semibold mb-2">Score Points</h2>
              <p className="text-gray-600">
                3 points for 1st place, 2 points for 2nd place, and 1 point for 3rd place based on accuracy and speed.
              </p>
            </div>
          </div>
          
          <div className="border-t border-b py-6 my-8">
            <h2 className="text-2xl font-heading font-semibold mb-4 text-center">Game Rules</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700 max-w-2xl mx-auto">
              <li><span className="font-medium">Timer:</span> Each round has a limited time for guessing</li>
              <li><span className="font-medium">Scoring:</span> Points are awarded based on how many correct words you guess and how quickly you submit</li>
              <li><span className="font-medium">Matching:</span> Words are matched regardless of order, but must be exact matches</li>
              <li><span className="font-medium">Rounds:</span> Multiple rounds are played, with a new prompt each round</li>
              <li><span className="font-medium">Winner:</span> The player with the most points at the end of all rounds wins</li>
            </ol>
          </div>
          
          <div className="flex justify-center">
            <Link href="/">
              <Button className="px-6 py-6 text-lg">
                <PlayIcon className="mr-2 h-5 w-5" />
                Start Playing Now
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="py-6">
          <h2 className="text-xl font-heading font-semibold mb-4">Tips for Success</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Focus on obvious elements in the image first</li>
            <li>Think about common descriptive words that might be in the prompt</li>
            <li>Consider the style, setting, colors, and actions visible in the image</li>
            <li>Try multiple guesses to match different words</li>
            <li>Watch other players' guesses for clues to words you might have missed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
