# ImagineMate - Multiplayer Guessing Game

ImagineMate is a real-time multiplayer guessing game powered by Google's Generative AI that creates unique, dynamic image-based challenges. Players compete by deciphering AI-generated images and matching their original prompts in a fast-paced, collaborative environment.

## 🎮 How It Works

1. **Create a Game**: A host creates a new game and receives a unique game code to share with friends.
2. **Join the Lobby**: Players join using the game code and wait in the lobby until the host starts the game.
3. **Prompt Time**: The host enters a creative text prompt (e.g., "elephants wearing tutus and dancing to breakbeat").
4. **AI Magic**: Google's Gemini AI generates an image based on the prompt.
5. **Guess & Score**: Players view the image and submit their best guesses of what the original prompt was.
6. **Points & Ranking**: Players earn points based on accuracy and speed:
   - 3 points for the winner
   - 2 points for second place
   - 1 point for third place
7. **Multiple Rounds**: Games consist of multiple rounds, with scores tallied across all rounds.

## 🚀 Key Features

- **Real-time Multiplayer**: WebSocket-based gameplay for instant feedback and updates
- **AI-Powered Images**: Integration with Google's Gemini Flash 2.0 Experimental model for image generation
- **Robust Connection Handling**: Automatic reconnection system that preserves game state
- **Round Timer**: Configurable countdown timer to keep the game moving
- **Responsive Design**: Plays well on desktop, tablet, and mobile devices

## 🏗️ Technical Architecture

### Frontend Components

- **Home**: Landing page with options to create or join a game
- **HostLobby**: Game creation and management interface for the host
- **JoinLobby**: Interface for players to join existing games
- **GamePlay**: The main gameplay screen showing the AI-generated image and guess input
- **ResultsScreen**: Displays round results and rankings
- **PlayerConnectionInfo**: Shows online status of all players in the game
- **PlayerGuesses**: Displays all guesses submitted for the current round

### Backend Services

- **WebSocket Server**: Handles real-time game events and player connections
- **Game State Management**: Maintains the current state of all active games
- **AI Integration**: Communicates with Google's Generative AI to create images
- **Storage System**: Persists game data, player information, and results
- **Word Matching Algorithm**: Analyzes player guesses to determine similarity to the original prompt

### Data Models

- **Game**: Contains game settings, status, and metadata
- **Player**: Represents a user in a specific game with score tracking
- **Round**: Contains the prompt, image URL, and timing information
- **Guess**: Stores player guesses with timestamps for speed calculation
- **RoundResult**: Contains the winners and scores for each round

## 🔧 Connection Management

- **Heartbeat System**: Regular pings to ensure connections remain active
- **Reconnection Logic**: Automatically reconnects dropped players with a 60-second grace period
- **Player Status Tracking**: Visual indicators showing which players are currently online
- **Server Restart Protocol**: Gracefully handles server restarts by redirecting all clients to home page

## 🛠️ Technologies Used

- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express
- **Real-time Communication**: WebSockets (ws)
- **AI Integration**: Google Generative AI SDK (Gemini)
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Replit

## 🔄 Game Flow

1. **Game Creation**:
   - Host creates game and receives a unique code
   - Game enters "lobby" status

2. **Player Joining**:
   - Players join using the game code
   - All players see who is in the lobby

3. **Game Start**:
   - Host starts the game
   - Game enters "playing" status

4. **Round Flow**:
   - Host enters a prompt
   - System generates an image
   - Players submit guesses within the time limit
   - System scores guesses and determines winners
   - Results are displayed to all players

5. **Game Continuation**:
   - Host advances to the next round
   - Process repeats until all rounds complete
   - Final scores and winner are announced

## 📱 User Interface Components

- **Game Navigation**: Intuitive controls for navigating through the game
- **Player Badges**: Visual indicators of player status (host, online, offline)
- **Timer Display**: Visual countdown for each round
- **Score Leaderboard**: Real-time ranking of players by score
- **Toast Notifications**: Non-intrusive feedback for game events

## 🔒 Security Features

- **Game Codes**: Randomly generated 6-character alphanumeric codes for game access
- **Player Authentication**: Simple username-based authentication system
- **Server-side Validation**: All game actions validated on the server to prevent cheating

---

Built with ❤️ using React, Node.js, and Google's Generative AI