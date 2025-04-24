import { db } from "./db";
import { IStorage } from "./storage";
import {
  User,
  InsertUser,
  Game,
  InsertGame,
  Round,
  InsertRound,
  Player,
  InsertPlayer,
  Guess,
  InsertGuess,
  RoundResult,
  InsertRoundResult,
  
  users,
  games,
  rounds,
  players,
  guesses,
  roundResults
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  // Game methods
  async createGame(game: InsertGame): Promise<Game> {
    // Ensure all required fields have values
    const gameWithDefaults = { 
      ...game, 
      status: game.status || "lobby",
      currentRound: game.currentRound || 1,
      totalRounds: game.totalRounds || 5,
      timerSeconds: game.timerSeconds || 60,
      createdAt: new Date()
    };
    
    const [newGame] = await db.insert(games).values(gameWithDefaults).returning();
    return newGame;
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async getGameByCode(code: string): Promise<Game | undefined> {
    // Case insensitive search
    code = code.toUpperCase();
    const allGames = await db.select().from(games);
    console.log(`Searching for game with code: ${code}`);
    console.log(`Available games: ${allGames.map(g => g.code).join(', ')}`);
    
    const game = allGames.find(game => game.code.toUpperCase() === code);
    if (game) {
      console.log(`Found game: ${game.code} (id: ${game.id})`);
    } else {
      console.log(`No game found with code: ${code}`);
    }
    
    return game;
  }

  async updateGame(id: number, updateData: Partial<Game>): Promise<Game> {
    const [updatedGame] = await db
      .update(games)
      .set(updateData)
      .where(eq(games.id, id))
      .returning();
    
    if (!updatedGame) {
      throw new Error(`Game with ID ${id} not found`);
    }
    
    return updatedGame;
  }

  // Round methods
  async createRound(round: InsertRound): Promise<Round> {
    // Ensure all required fields have values
    const roundWithDefaults = { 
      ...round, 
      status: round.status || "waiting",
      imageUrl: round.imageUrl || null,
      startTime: null,
      endTime: null
    };
    
    const [newRound] = await db
      .insert(rounds)
      .values(roundWithDefaults)
      .returning();
      
    return newRound;
  }

  async getRound(id: number): Promise<Round | undefined> {
    const [round] = await db.select().from(rounds).where(eq(rounds.id, id));
    return round;
  }

  async getRoundsByGameId(gameId: number): Promise<Round[]> {
    return db.select().from(rounds).where(eq(rounds.gameId, gameId));
  }

  async getCurrentRound(gameId: number): Promise<Round | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    if (!game) return undefined;
    
    const [round] = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.gameId, gameId),
          eq(rounds.roundNumber, game.currentRound)
        )
      );
      
    return round;
  }

  async updateRound(id: number, updateData: Partial<Round>): Promise<Round> {
    const [updatedRound] = await db
      .update(rounds)
      .set(updateData)
      .where(eq(rounds.id, id))
      .returning();
    
    if (!updatedRound) {
      throw new Error(`Round with ID ${id} not found`);
    }
    
    return updatedRound;
  }

  // Player methods
  async createPlayer(player: InsertPlayer): Promise<Player> {
    // Ensure all required fields have values
    const playerWithDefaults = { 
      ...player, 
      score: player.score ?? 0,
      isHost: player.isHost ?? false,
      isActive: player.isActive ?? true,
      joinedAt: new Date()
    };
    
    const [newPlayer] = await db
      .insert(players)
      .values(playerWithDefaults)
      .returning();
      
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async getPlayersByGameId(gameId: number): Promise<Player[]> {
    return db
      .select()
      .from(players)
      .where(
        and(
          eq(players.gameId, gameId),
          eq(players.isActive, true)
        )
      );
  }

  async updatePlayer(id: number, updateData: Partial<Player>): Promise<Player> {
    const [updatedPlayer] = await db
      .update(players)
      .set(updateData)
      .where(eq(players.id, id))
      .returning();
    
    if (!updatedPlayer) {
      throw new Error(`Player with ID ${id} not found`);
    }
    
    return updatedPlayer;
  }

  async getPlayerByGameAndUser(gameId: number, userId: number): Promise<Player | undefined> {
    const [player] = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.gameId, gameId),
          eq(players.userId, userId)
        )
      );
      
    return player;
  }

  // Guess methods
  async createGuess(guess: InsertGuess): Promise<Guess> {
    // Ensure all required fields have values
    const guessWithDefaults = { 
      ...guess, 
      matchedWords: guess.matchedWords ?? [],
      matchCount: guess.matchCount ?? 0,
      submittedAt: new Date()
    };
    
    const [newGuess] = await db
      .insert(guesses)
      .values(guessWithDefaults)
      .returning();
      
    return newGuess;
  }

  async getGuessesByRoundId(roundId: number): Promise<Guess[]> {
    return db
      .select()
      .from(guesses)
      .where(eq(guesses.roundId, roundId));
  }

  async getGuessesByPlayerId(playerId: number): Promise<Guess[]> {
    return db
      .select()
      .from(guesses)
      .where(eq(guesses.playerId, playerId));
  }

  async getGuessesByRoundAndPlayer(roundId: number, playerId: number): Promise<Guess[]> {
    return db
      .select()
      .from(guesses)
      .where(
        and(
          eq(guesses.roundId, roundId),
          eq(guesses.playerId, playerId)
        )
      );
  }

  // Round Results methods
  async createRoundResult(result: InsertRoundResult): Promise<RoundResult> {
    // Ensure all required fields have values
    const resultWithDefaults = { 
      ...result, 
      firstPlaceId: result.firstPlaceId ?? null,
      secondPlaceId: result.secondPlaceId ?? null,
      thirdPlaceId: result.thirdPlaceId ?? null,
      completedAt: new Date()
    };
    
    const [newResult] = await db
      .insert(roundResults)
      .values(resultWithDefaults)
      .returning();
      
    return newResult;
  }

  async getRoundResult(id: number): Promise<RoundResult | undefined> {
    const [result] = await db
      .select()
      .from(roundResults)
      .where(eq(roundResults.id, id));
      
    return result;
  }

  async getRoundResultByRoundId(roundId: number): Promise<RoundResult | undefined> {
    const [result] = await db
      .select()
      .from(roundResults)
      .where(eq(roundResults.roundId, roundId));
      
    return result;
  }
}