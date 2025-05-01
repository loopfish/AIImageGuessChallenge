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
  // Initialize a WebSocket connection to verify server connectivity
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {};
        socket.onmessage = () => {};
        socket.onerror = () => {};
        socket.onclose = () => {};
        
        return () => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        };
      } catch (error) {
        return () => {}; // Empty cleanup function
      }
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
