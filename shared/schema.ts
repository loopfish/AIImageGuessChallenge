import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostId: integer("host_id").notNull(),
  status: text("status").notNull().default("lobby"), // lobby, playing, finished
  currentRound: integer("current_round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(5),
  timerSeconds: integer("timer_seconds").notNull().default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
});

export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  roundNumber: integer("round_number").notNull(),
  prompt: text("prompt").notNull(),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("pending"), // pending, active, completed
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
});

export const insertRoundSchema = createInsertSchema(rounds).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  score: integer("score").notNull().default(0),
  isHost: boolean("is_host").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  joinedAt: true,
});

export const guesses = pgTable("guesses", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull(),
  playerId: integer("player_id").notNull(),
  guessText: text("guess_text").notNull(),
  matchedWords: text("matched_words").array(),
  matchCount: integer("match_count").notNull().default(0),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertGuessSchema = createInsertSchema(guesses).omit({
  id: true,
  submittedAt: true,
});

export const roundResults = pgTable("round_results", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull(),
  firstPlaceId: integer("first_place_id"),
  secondPlaceId: integer("second_place_id"),
  thirdPlaceId: integer("third_place_id"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const insertRoundResultSchema = createInsertSchema(roundResults).omit({
  id: true,
  completedAt: true,
});

// Game message types
export enum GameMessageType {
  JOIN_GAME = "join_game",
  CREATE_GAME = "create_game",
  START_GAME = "start_game",
  SUBMIT_GUESS = "submit_guess",
  NEXT_ROUND = "next_round",
  PLAYER_JOINED = "player_joined",
  END_GAME = "end_game",
  PLAYER_UPDATE = "player_update",
  GAME_STATE = "game_state",
  ROUND_START = "round_start",
  ROUND_END = "round_end",
  GAME_ERROR = "game_error",
  PLAYER_GUESS = "player_guess",
  TIMER_UPDATE = "timer_update",
  
  // Reconnection message types
  RECONNECT_REQUEST = "reconnect_request",
  RECONNECT_SUCCESS = "reconnect_success",
  RECONNECT_FAILURE = "reconnect_failure",
  
  // Connection status messages
  HEARTBEAT = "heartbeat",
  HEARTBEAT_RESPONSE = "heartbeat_response",
  PLAYERS_ONLINE_UPDATE = "players_online_update",
  
  // Server connection notification
  WELCOME = "welcome"
}

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

export type InsertRound = z.infer<typeof insertRoundSchema>;
export type Round = typeof rounds.$inferSelect;

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export type InsertGuess = z.infer<typeof insertGuessSchema>;
export type Guess = typeof guesses.$inferSelect;

export type InsertRoundResult = z.infer<typeof insertRoundResultSchema>;
export type RoundResult = typeof roundResults.$inferSelect;

// Client types
export interface GameState {
  game: Game;
  players: Player[];
  currentRound?: Round;
  playerGuesses?: Guess[];
  roundResults?: RoundResult;
  timeRemaining?: number;
  currentPlayerId?: number; // ID of the current player
  onlinePlayers?: number[];  // Array of player IDs that are currently online
}

// WebSocket message types
export interface WebSocketMessage {
  type: GameMessageType;
  payload: any;
}

export interface CreateGameMessage extends WebSocketMessage {
  type: GameMessageType.CREATE_GAME;
  payload: {
    username: string;
    timerSeconds: number;
    totalRounds: number;
  };
}

export interface JoinGameMessage extends WebSocketMessage {
  type: GameMessageType.JOIN_GAME;
  payload: {
    username: string;
    gameCode: string;
  };
}

export interface StartGameMessage extends WebSocketMessage {
  type: GameMessageType.START_GAME;
  payload: {
    gameId: number;
    prompt: string;
  };
}

export interface SubmitGuessMessage extends WebSocketMessage {
  type: GameMessageType.SUBMIT_GUESS;
  payload: {
    gameId: number;
    playerId: number;
    roundId: number;
    guessText: string;
  };
}

export interface NextRoundMessage extends WebSocketMessage {
  type: GameMessageType.NEXT_ROUND;
  payload: {
    gameId: number;
    prompt: string;
  };
}

export interface PlayerGuessMessage extends WebSocketMessage {
  type: GameMessageType.PLAYER_GUESS;
  payload: Guess & {
    username: string;
    timestamp: string;
  };
}

export interface GameStateMessage extends WebSocketMessage {
  type: GameMessageType.GAME_STATE;
  payload: GameState;
}

export interface PlayerUpdateMessage extends WebSocketMessage {
  type: GameMessageType.PLAYER_UPDATE;
  payload: {
    players: Player[];
  };
}

export interface RoundStartMessage extends WebSocketMessage {
  type: GameMessageType.ROUND_START;
  payload: {
    round: Round;
    timeRemaining: number;
  };
}

export interface RoundEndMessage extends WebSocketMessage {
  type: GameMessageType.ROUND_END;
  payload: {
    round: Round;
    results: RoundResult & {
      firstPlace?: Player & { matchedWords: string[] };
      secondPlace?: Player & { matchedWords: string[] };
      thirdPlace?: Player & { matchedWords: string[] };
    };
    standings: Player[];
  };
}

export interface TimerUpdateMessage extends WebSocketMessage {
  type: GameMessageType.TIMER_UPDATE;
  payload: {
    timeRemaining: number;
  };
}

export interface GameErrorMessage extends WebSocketMessage {
  type: GameMessageType.GAME_ERROR;
  payload: {
    message: string;
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: GameMessageType.HEARTBEAT;
  payload: {
    playerId: number;
    gameId: number;
    timestamp: number;
  };
}

export interface HeartbeatResponseMessage extends WebSocketMessage {
  type: GameMessageType.HEARTBEAT_RESPONSE;
  payload: {
    acknowledged: boolean;
    timestamp: number;
  };
}

export interface PlayersOnlineUpdateMessage extends WebSocketMessage {
  type: GameMessageType.PLAYERS_ONLINE_UPDATE;
  payload: {
    gameId: number;
    onlinePlayers: number[]; // Array of player IDs that are currently online
  };
}

export interface WelcomeMessage extends WebSocketMessage {
  type: GameMessageType.WELCOME;
  payload: {
    message: string;
  };
}
