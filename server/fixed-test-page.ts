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
      .logs {
        margin-top: 20px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        font-family: monospace;
        font-size: 12px;
      }
      .hidden {
        display: none;
      }
      .tab-container {
        margin-top: 20px;
      }
      .tabs {
        display: flex;
        border-bottom: 1px solid #ddd;
      }
      .tab {
        padding: 10px 15px;
        cursor: pointer;
      }
      .tab.active {
        border-bottom: 2px solid #5D3FD3;
        font-weight: bold;
      }
      .tab-content {
        padding: 15px;
        background: #f9f9f9;
        border-radius: 0 0 4px 4px;
      }
      .tab-panel {
        display: none;
      }
      .tab-panel.active {
        display: block;
      }
      .game-info {
        background: #fff;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 15px;
      }
      .direct-actions {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #eee;
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
      
      <div class="tab-container">
        <div class="tabs">
          <div class="tab active" data-tab="game-status">Game Status</div>
          <div class="tab" data-tab="debug">Debug Tools</div>
        </div>
        
        <div class="tab-content">
          <div class="tab-panel active" id="game-status-panel">
            <div id="game-info" class="game-info">
              <h3>Current Game Status</h3>
              <div id="game-status">Loading...</div>
            </div>
          </div>
          
          <div class="tab-panel" id="debug-panel">
            <h3>Debug Actions</h3>
            
            <div class="direct-actions">
              <button id="check-game">Check TESTGAME Status</button>
              <button id="direct-join">Direct Join via URL</button>
              <button id="clear-storage">Clear Local Storage</button>
            </div>
            
            <div id="logs" class="logs"></div>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      // Utility function to log messages
      function log(message) {
        const logsElement = document.getElementById('logs');
        const logItem = document.createElement('div');
        logItem.textContent = new Date().toLocaleTimeString() + ': ' + message;
        logsElement.appendChild(logItem);
        logsElement.scrollTop = logsElement.scrollHeight;
      }
      
      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          // Remove active class from all tabs
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          
          // Add active class to clicked tab
          tab.classList.add('active');
          document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
        });
      });
      
      // Check game status
      async function checkGameStatus() {
        try {
          document.getElementById('game-status').textContent = 'Checking game status...';
          
          const response = await fetch('/api/games/TESTGAME/state');
          log('Game status check: ' + response.status);
          
          if (response.ok) {
            const data = await response.json();
            log('Game exists with ' + data.players.length + ' players');
            
            // Display game info
            const gameInfo = document.getElementById('game-status');
            gameInfo.innerHTML = \`
              <div><strong>Game Code:</strong> \${data.game.code}</div>
              <div><strong>Status:</strong> \${data.game.status}</div>
              <div><strong>Players:</strong> \${data.players.length}</div>
              <div><strong>Current Round:</strong> \${data.game.currentRound} of \${data.game.totalRounds}</div>
              <div><strong>Created:</strong> \${new Date(data.game.createdAt).toLocaleString()}</div>
              <div><strong>Players:</strong></div>
              <ul>
                \${data.players.map(p => \`<li>\${p.username} (ID: \${p.id}, Host: \${p.isHost})</li>\`).join('')}
              </ul>
            \`;
          } else {
            const gameInfo = document.getElementById('game-status');
            gameInfo.innerHTML = '<div class="error">Game not found</div>';
            log('Game not found');
          }
        } catch (error) {
          log('Error checking game: ' + error.message);
          document.getElementById('game-status').textContent = 'Error checking game status';
        }
      }
      
      // Check game status on load
      checkGameStatus();
      
      document.getElementById('create-game').addEventListener('click', async function() {
        const username = document.getElementById('username').value;
        
        if (!username) {
          alert('Please enter a username');
          return;
        }
        
        try {
          log('Creating test game with username: ' + username);
          const response = await fetch('/api/test/create-game?username=' + encodeURIComponent(username));
          const data = await response.json();
          
          log('Create game response: ' + JSON.stringify(data));
          
          if (data.success) {
            document.getElementById('result').classList.remove('hidden');
            checkGameStatus();
          } else {
            alert('Error: ' + data.message);
          }
        } catch (error) {
          log('Failed to create game: ' + error.message);
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
          log('Joining test game with username: ' + username);
          const response = await fetch('/api/test/join-game?username=' + encodeURIComponent(username));
          const data = await response.json();
          
          log('Join game response: ' + JSON.stringify(data));
          
          if (data.success) {
            // Store player ID in localStorage
            if (data.playerId) {
              log('Saving player ID to localStorage: ' + data.playerId);
              localStorage.setItem('currentPlayerId', data.playerId.toString());
            }
            
            // Then redirect to the game page
            log('Redirecting to game page: /#/game/TESTGAME');
            window.location.href = '/#/game/TESTGAME';
          } else {
            alert('Error: ' + data.message);
          }
        } catch (error) {
          log('Failed to join game: ' + error.message);
          alert('Failed to join game: ' + error.message);
        }
      });
      
      document.getElementById('go-to-game').addEventListener('click', function() {
        log('Going to game page: /#/game/TESTGAME');
        window.location.href = '/#/game/TESTGAME';
      });
      
      // Debug buttons
      document.getElementById('check-game').addEventListener('click', checkGameStatus);
      
      document.getElementById('direct-join').addEventListener('click', function() {
        log('Direct joining via URL: /#/game/TESTGAME');
        window.location.href = '/#/game/TESTGAME';
      });
      
      document.getElementById('clear-storage').addEventListener('click', function() {
        localStorage.removeItem('currentPlayerId');
        log('Cleared local storage (currentPlayerId)');
        alert('Local storage cleared successfully');
      });
    </script>
  </body>
  </html>
  `;
}