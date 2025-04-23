import { 
  User, InsertUser, Game, InsertGame, 
  Round, InsertRound, Player, InsertPlayer,
  Guess, InsertGuess, RoundResult, InsertRoundResult
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game methods
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  getGameByCode(code: string): Promise<Game | undefined>;
  updateGame(id: number, game: Partial<Game>): Promise<Game>;
  
  // Round methods
  createRound(round: InsertRound): Promise<Round>;
  getRound(id: number): Promise<Round | undefined>;
  getRoundsByGameId(gameId: number): Promise<Round[]>;
  getCurrentRound(gameId: number): Promise<Round | undefined>;
  updateRound(id: number, round: Partial<Round>): Promise<Round>;
  
  // Player methods
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByGameId(gameId: number): Promise<Player[]>;
  updatePlayer(id: number, player: Partial<Player>): Promise<Player>;
  getPlayerByGameAndUser(gameId: number, userId: number): Promise<Player | undefined>;
  
  // Guess methods
  createGuess(guess: InsertGuess): Promise<Guess>;
  getGuessesByRoundId(roundId: number): Promise<Guess[]>;
  getGuessesByPlayerId(playerId: number): Promise<Guess[]>;
  getGuessesByRoundAndPlayer(roundId: number, playerId: number): Promise<Guess[]>;
  
  // Round Results methods
  createRoundResult(result: InsertRoundResult): Promise<RoundResult>;
  getRoundResult(id: number): Promise<RoundResult | undefined>;
  getRoundResultByRoundId(roundId: number): Promise<RoundResult | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<number, Game>;
  private rounds: Map<number, Round>;
  private players: Map<number, Player>;
  private guesses: Map<number, Guess>;
  private roundResults: Map<number, RoundResult>;
  
  private userIdCounter: number;
  private gameIdCounter: number;
  private roundIdCounter: number;
  private playerIdCounter: number;
  private guessIdCounter: number;
  private resultIdCounter: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.rounds = new Map();
    this.players = new Map();
    this.guesses = new Map();
    this.roundResults = new Map();
    
    this.userIdCounter = 1;
    this.gameIdCounter = 1;
    this.roundIdCounter = 1;
    this.playerIdCounter = 1;
    this.guessIdCounter = 1;
    this.resultIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Game methods
  async createGame(game: InsertGame): Promise<Game> {
    const id = this.gameIdCounter++;
    const createdAt = new Date();
    const newGame: Game = { ...game, id, createdAt };
    this.games.set(id, newGame);
    return newGame;
  }
  
  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }
  
  async getGameByCode(code: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find(
      (game) => game.code === code,
    );
  }
  
  async updateGame(id: number, updateData: Partial<Game>): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) {
      throw new Error(`Game with ID ${id} not found`);
    }
    
    const updatedGame = { ...game, ...updateData };
    this.games.set(id, updatedGame);
    return updatedGame;
  }
  
  // Round methods
  async createRound(round: InsertRound): Promise<Round> {
    const id = this.roundIdCounter++;
    const newRound: Round = { ...round, id, startTime: null, endTime: null };
    this.rounds.set(id, newRound);
    return newRound;
  }
  
  async getRound(id: number): Promise<Round | undefined> {
    return this.rounds.get(id);
  }
  
  async getRoundsByGameId(gameId: number): Promise<Round[]> {
    return Array.from(this.rounds.values()).filter(
      (round) => round.gameId === gameId,
    );
  }
  
  async getCurrentRound(gameId: number): Promise<Round | undefined> {
    const game = await this.getGame(gameId);
    if (!game) return undefined;
    
    return Array.from(this.rounds.values()).find(
      (round) => round.gameId === gameId && round.roundNumber === game.currentRound
    );
  }
  
  async updateRound(id: number, updateData: Partial<Round>): Promise<Round> {
    const round = await this.getRound(id);
    if (!round) {
      throw new Error(`Round with ID ${id} not found`);
    }
    
    const updatedRound = { ...round, ...updateData };
    this.rounds.set(id, updatedRound);
    return updatedRound;
  }
  
  // Player methods
  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = this.playerIdCounter++;
    const joinedAt = new Date();
    const newPlayer: Player = { ...player, id, joinedAt };
    this.players.set(id, newPlayer);
    return newPlayer;
  }
  
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }
  
  async getPlayersByGameId(gameId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(
      (player) => player.gameId === gameId && player.isActive
    );
  }
  
  async updatePlayer(id: number, updateData: Partial<Player>): Promise<Player> {
    const player = await this.getPlayer(id);
    if (!player) {
      throw new Error(`Player with ID ${id} not found`);
    }
    
    const updatedPlayer = { ...player, ...updateData };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }
  
  async getPlayerByGameAndUser(gameId: number, userId: number): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(
      (player) => player.gameId === gameId && player.userId === userId
    );
  }
  
  // Guess methods
  async createGuess(guess: InsertGuess): Promise<Guess> {
    const id = this.guessIdCounter++;
    const submittedAt = new Date();
    const newGuess: Guess = { ...guess, id, submittedAt };
    this.guesses.set(id, newGuess);
    return newGuess;
  }
  
  async getGuessesByRoundId(roundId: number): Promise<Guess[]> {
    return Array.from(this.guesses.values()).filter(
      (guess) => guess.roundId === roundId
    );
  }
  
  async getGuessesByPlayerId(playerId: number): Promise<Guess[]> {
    return Array.from(this.guesses.values()).filter(
      (guess) => guess.playerId === playerId
    );
  }
  
  async getGuessesByRoundAndPlayer(roundId: number, playerId: number): Promise<Guess[]> {
    return Array.from(this.guesses.values()).filter(
      (guess) => guess.roundId === roundId && guess.playerId === playerId
    );
  }
  
  // Round Results methods
  async createRoundResult(result: InsertRoundResult): Promise<RoundResult> {
    const id = this.resultIdCounter++;
    const completedAt = new Date();
    const newResult: RoundResult = { ...result, id, completedAt };
    this.roundResults.set(id, newResult);
    return newResult;
  }
  
  async getRoundResult(id: number): Promise<RoundResult | undefined> {
    return this.roundResults.get(id);
  }
  
  async getRoundResultByRoundId(roundId: number): Promise<RoundResult | undefined> {
    return Array.from(this.roundResults.values()).find(
      (result) => result.roundId === roundId
    );
  }
}

export const storage = new MemStorage();
