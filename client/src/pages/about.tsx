import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto fadeInUp">
      <Card className="mb-8">
        <CardHeader>
          <h1 className="text-3xl font-heading font-bold text-center">About Prompt Guesser</h1>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Prompt Guesser is an engaging multiplayer game that explores the creative intersection of artificial intelligence and human imagination. Players compete to guess the prompts used to generate AI images, testing their observation skills and creative thinking.
          </p>
          
          <h2 className="text-2xl font-heading font-semibold mt-6">Our Story</h2>
          <p className="text-gray-700">
            Prompt Guesser was created as a fun way to explore the growing field of AI image generation. As AI models like Gemini can produce increasingly impressive images from text prompts, we wanted to create a game that celebrates this technology while bringing people together in a friendly competition.
          </p>
          
          <h2 className="text-2xl font-heading font-semibold mt-6">How It Works</h2>
          <p className="text-gray-700">
            Behind the scenes, Prompt Guesser uses Google's Gemini AI to generate images based on the text prompts provided by game hosts. Our custom word-matching algorithm then evaluates player guesses to determine accuracy, while our real-time game system keeps track of scores and timing.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <div className="bg-primary/5 p-4 rounded-lg">
              <h3 className="font-heading font-semibold mb-2">Real-time Gameplay</h3>
              <p className="text-sm text-gray-600">
                Instant updates and feedback for all players through WebSocket connections
              </p>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg">
              <h3 className="font-heading font-semibold mb-2">AI Integration</h3>
              <p className="text-sm text-gray-600">
                Powered by Google's Gemini AI for high-quality image generation
              </p>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg">
              <h3 className="font-heading font-semibold mb-2">Word Matching</h3>
              <p className="text-sm text-gray-600">
                Sophisticated algorithm to score guesses based on word matches
              </p>
            </div>
          </div>
          
          <h2 className="text-2xl font-heading font-semibold mt-8">Our Team</h2>
          <p className="text-gray-700">
            Prompt Guesser was developed by a small team of developers passionate about AI, gaming, and bringing people together through technology. We're constantly working to improve the game and add new features.
          </p>
          
          <h2 className="text-2xl font-heading font-semibold mt-8">Contact Us</h2>
          <p className="text-gray-700">
            We'd love to hear your feedback and suggestions for Prompt Guesser! You can reach us at:
          </p>
          <p className="text-primary font-medium">contact@promptguesser.com</p>
        </CardContent>
      </Card>
    </div>
  );
}
