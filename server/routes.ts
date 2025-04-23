import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { setupWebsocketHandlers } from "./websocket";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create a WebSocket server on a specific path and make sure to log connections
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true  // Enable client tracking
  });
  
  // Log WebSocket server events
  wss.on('listening', () => {
    console.log('WebSocket server is listening');
  });
  
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });
  
  // Setup WebSocket message handlers
  setupWebsocketHandlers(wss, storage);

  // API routes
  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok" });
  });

  // Get game by code
  app.get("/api/games/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const game = await storage.getGameByCode(code);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Get players for the game
      const players = await storage.getPlayersByGameId(game.id);
      
      // Get current round if game is in playing status
      let currentRound = null;
      if (game.status === "playing") {
        currentRound = await storage.getCurrentRound(game.id);
      }
      
      res.json({ game, players, currentRound });
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // Get game state API (useful for initial page load)
  app.get("/api/games/:code/state", async (req, res) => {
    try {
      const { code } = req.params;
      const game = await storage.getGameByCode(code);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      // Get players for the game
      const players = await storage.getPlayersByGameId(game.id);
      
      let currentRound = undefined;
      let playerGuesses = undefined;
      let roundResults = undefined;
      
      // Get current round if game is in playing status
      if (game.status === "playing" || game.status === "round_end") {
        currentRound = await storage.getCurrentRound(game.id);
        
        if (currentRound) {
          playerGuesses = await storage.getGuessesByRoundId(currentRound.id);
          roundResults = await storage.getRoundResultByRoundId(currentRound.id);
        }
      }
      
      res.json({ 
        game, 
        players, 
        currentRound, 
        playerGuesses, 
        roundResults 
      });
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ message: "Failed to fetch game state" });
    }
  });

  return httpServer;
}
