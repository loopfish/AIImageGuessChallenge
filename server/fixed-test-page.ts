export function renderFixedTestPage() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Image Guessing Game - Test</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      input, button {
        padding: 10px;
        font-size: 16px;
      }
      button {
        cursor: pointer;
        background: #5D3FD3;
        color: white;
        border: none;
        border-radius: 4px;
      }
      .result {
        margin-top: 20px;
        padding: 15px;
        background: #f0f0f0;
        border-radius: 4px;
      }
      .game-code {
        font-size: 24px;
        font-weight: bold;
        background: #333;
        color: white;
        padding: 10px;
        border-radius: 4px;
        text-align: center;
        margin: 10px 0;
      }
      .hidden {
        display: none;
      }
    </style>
  </head>
  <body>
    <h1>AI Image Guessing Game - Test Environment</h1>
    <p>Use this page to create a test game with a fixed game code that's easy to join from other devices.</p>
    
    <div class="container">
      <div class="form-group">
        <label for="username">Your Username:</label>
        <input type="text" id="username" placeholder="Enter your username" value="TestUser">
      </div>
      
      <button id="create-game">Create Test Game</button>
      <button id="join-game">Join Test Game</button>
      
      <div id="result" class="result hidden">
        <h2>Game Created!</h2>
        <p>You can now join this game using the code:</p>
        <div class="game-code">TESTGAME</div>
        <p>Share this code with other players to join the game.</p>
        <button id="go-to-game">Go to Game</button>
      </div>
    </div>
    
    <script>
      document.getElementById('create-game').addEventListener('click', async function() {
        const username = document.getElementById('username').value;
        
        if (!username) {
          alert('Please enter a username');
          return;
        }
        
        try {
          const response = await fetch('/api/test/create-game?username=' + encodeURIComponent(username));
          const data = await response.json();
          
          if (data.success) {
            document.getElementById('result').classList.remove('hidden');
          } else {
            alert('Error: ' + data.message);
          }
        } catch (error) {
          alert('Failed to create game: ' + error.message);
        }
      });
      
      document.getElementById('join-game').addEventListener('click', async function() {
        const username = document.getElementById('username').value;
        
        if (!username) {
          alert('Please enter a username');
          return;
        }
        
        try {
          // First call the join test endpoint
          const response = await fetch('/api/test/join-game?username=' + encodeURIComponent(username));
          const data = await response.json();
          
          if (data.success) {
            // Then redirect to the game join page
            window.location.href = '/#/game/TESTGAME';
          } else {
            alert('Error: ' + data.message);
          }
        } catch (error) {
          alert('Failed to join game: ' + error.message);
        }
      });
      
      document.getElementById('go-to-game').addEventListener('click', function() {
        window.location.href = '/#/game/TESTGAME';
      });
    </script>
  </body>
  </html>
  `;
}