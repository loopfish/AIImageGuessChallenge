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
  
  // Path for persistence file
  private static readonly STORAGE_FILE = './game-data.json';
  
  // Serialization interval in milliseconds
  private static readonly SAVE_INTERVAL = 10000; // 10 seconds
  private saveInterval: NodeJS.Timeout | null = null;
  
  // Import the fs module once at the start
  private static fsPromises: any = null;

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
    
    // Try to load data from disk
    (async () => {
      try {
        await this.loadFromDisk();
      } catch (error) {
        console.error('Error loading data during initialization:', error);
      }
    })();
    
    // Setup periodic saving
    this.saveInterval = setInterval(async () => {
      try {
        await this.saveToDisk();
      } catch (error) {
        console.error('Error in periodic save:', error);
      }
    }, MemStorage.SAVE_INTERVAL);
  }
  
  /**
   * Save the current state to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      
      const data = {
        users: Array.from(this.users.entries()),
        games: Array.from(this.games.entries()),
        rounds: Array.from(this.rounds.entries()),
        players: Array.from(this.players.entries()),
        guesses: Array.from(this.guesses.entries()),
        roundResults: Array.from(this.roundResults.entries()),
        counters: {
          user: this.userIdCounter,
          game: this.gameIdCounter,
          round: this.roundIdCounter,
          player: this.playerIdCounter,
          guess: this.guessIdCounter,
          result: this.resultIdCounter
        }
      };
      
      await fs.writeFile(MemStorage.STORAGE_FILE, JSON.stringify(data, null, 2));
      console.log('Game data saved to disk');
    } catch (error) {
      console.error('Failed to save data to disk:', error);
    }
  }
  
  /**
   * Load state from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      // Import fs modules using ESM
      const fsPromises = await import('fs/promises');
      
      try {
        // Try to access the file - if it doesn't exist, this will throw an error
        await fsPromises.access(MemStorage.STORAGE_FILE);
      } catch (err) {
        console.log('No saved data found, starting with empty database');
        return;
      }
      
      const rawData = await fsPromises.readFile(MemStorage.STORAGE_FILE, 'utf8');
      const data = JSON.parse(rawData);
      
      // Restore maps
      this.users = new Map(data.users);
      this.games = new Map(data.games);
      this.rounds = new Map(data.rounds);
      this.players = new Map(data.players);
      this.guesses = new Map(data.guesses);
      this.roundResults = new Map(data.roundResults);
      
      // Restore counters
      this.userIdCounter = data.counters.user;
      this.gameIdCounter = data.counters.game;
      this.roundIdCounter = data.counters.round;
      this.playerIdCounter = data.counters.player;
      this.guessIdCounter = data.counters.guess;
      this.resultIdCounter = data.counters.result;
      
      // Fix any missing required fields to satisfy TypeScript
      this.games.forEach(game => {
        if (game.status === undefined) game.status = 'lobby';
        if (game.currentRound === undefined) game.currentRound = 1;
        if (game.totalRounds === undefined) game.totalRounds = 5;
        if (game.timerSeconds === undefined) game.timerSeconds = 60;
      });
      
      this.rounds.forEach(round => {
        if (round.status === undefined) round.status = 'waiting';
        if (round.imageUrl === undefined) round.imageUrl = null;
      });
      
      this.players.forEach(player => {
        if (player.score === undefined) player.score = 0;
        if (player.isHost === undefined) player.isHost = false;
        if (player.isActive === undefined) player.isActive = true;
      });
      
      this.guesses.forEach(guess => {
        if (guess.matchedWords === undefined) guess.matchedWords = null;
        if (guess.matchCount === undefined) guess.matchCount = 0;
      });
      
      this.roundResults.forEach(result => {
        if (result.firstPlaceId === undefined) result.firstPlaceId = null;
        if (result.secondPlaceId === undefined) result.secondPlaceId = null;
        if (result.thirdPlaceId === undefined) result.thirdPlaceId = null;
      });
      
      // Convert string dates back to Date objects
      this.games.forEach(game => {
        if (game.createdAt && typeof game.createdAt === 'string') {
          game.createdAt = new Date(game.createdAt);
        }
      });
      
      this.players.forEach(player => {
        if (player.joinedAt && typeof player.joinedAt === 'string') {
          player.joinedAt = new Date(player.joinedAt);
        }
      });
      
      this.rounds.forEach(round => {
        if (round.startTime && typeof round.startTime === 'string') {
          round.startTime = new Date(round.startTime);
        }
        if (round.endTime && typeof round.endTime === 'string') {
          round.endTime = new Date(round.endTime);
        }
      });
      
      this.guesses.forEach(guess => {
        if (guess.submittedAt && typeof guess.submittedAt === 'string') {
          guess.submittedAt = new Date(guess.submittedAt);
        }
      });
      
      this.roundResults.forEach(result => {
        if (result.completedAt && typeof result.completedAt === 'string') {
          result.completedAt = new Date(result.completedAt);
        }
      });
      
      console.log('Loaded game data from disk');
      console.log(`Available games: ${Array.from(this.games.values()).map(g => g.code).join(', ')}`);
    } catch (error) {
      console.error('Failed to load data from disk:', error);
    }
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
    console.log(`Searching for game with code: ${code}`);
    const allGames = Array.from(this.games.values());
    console.log(`Available games: ${allGames.map(g => g.code).join(', ')}`);
    
    // Make sure we do a case-insensitive comparison for the code
    const game = allGames.find(
      (game) => game.code.toUpperCase() === code.toUpperCase(),
    );
    
    if (game) {
      console.log(`Found game: ${game.code} (id: ${game.id})`);
    } else {
      console.log(`No game found with code: ${code}`);
    }
    
    return game;
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
