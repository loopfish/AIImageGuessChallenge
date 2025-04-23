import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/hooks/use-game";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Game from "@/pages/game";
import HowToPlay from "@/pages/how-to-play";
import About from "@/pages/about";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/game/:code" component={Game} />
      <Route path="/how-to-play" component={HowToPlay} />
      <Route path="/about" component={About} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Create a websocket connection
  useEffect(() => {
    // Simple WebSocket connection test 
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const wsUrl = `${protocol}//${host}:5000/ws`;
      
      console.log("Testing direct WebSocket connection to:", wsUrl);
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("Direct WebSocket connection successful!");
      };
      
      socket.onerror = (error) => {
        console.error("Direct WebSocket connection error:", error);
      };
      
      socket.onclose = () => {
        console.log("Direct WebSocket connection closed");
      };
      
      return () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };
    
    const cleanup = connectWebSocket();
    return cleanup;
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <GameProvider>
        <TooltipProvider>
          <Toaster />
          <div className="min-h-screen flex flex-col bg-neutral-light">
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8">
              <Router />
            </main>
            <Footer />
          </div>
        </TooltipProvider>
      </GameProvider>
    </QueryClientProvider>
  );
}

export default App;
