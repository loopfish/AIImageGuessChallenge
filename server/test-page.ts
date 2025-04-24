import { Request, Response } from "express";

// HTML for the Gemini image generation test page
export function renderTestPage(req: Request, res: Response) {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gemini Image Generation Test</title>
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
          display: none;
        }
        .image-container {
          margin-top: 20px;
          border: 1px solid #ddd;
          padding: 10px;
          max-width: 100%;
        }
        img {
          max-width: 100%;
          display: block;
          margin: 0 auto;
        }
        .logs {
          margin-top: 20px;
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
          font-family: monospace;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
        }
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #5D3FD3;
          animation: spin 1s linear infinite;
          margin: 20px auto;
          display: none;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <h1>Gemini Native Image Generation Test</h1>
      <div class="container">
        <div class="form-group">
          <label for="prompt">Image Prompt:</label>
          <input type="text" id="prompt" placeholder="A cat wearing sunglasses on a beach" value="A sheep playing tennis on the moon">
        </div>
        <button id="generate">Generate Image</button>
        <div class="spinner" id="spinner"></div>
        <div class="logs" id="logs"></div>
        <div class="result" id="result">
          <h2>Generated Image:</h2>
          <div class="image-container">
            <img id="generated-image" src="" alt="Generated image will appear here">
          </div>
          <div id="response-container" class="mt-4">
            <h3>Model Response:</h3>
            <pre id="response-text"></pre>
          </div>
        </div>
      </div>

      <script>
        const logElement = document.getElementById('logs');
        const resultElement = document.getElementById('result');
        const imageElement = document.getElementById('generated-image');
        const responseTextElement = document.getElementById('response-text');
        const spinnerElement = document.getElementById('spinner');
        
        function log(message) {
          const logLine = document.createElement('div');
          logLine.textContent = message;
          logElement.appendChild(logLine);
          logElement.scrollTop = logElement.scrollHeight;
        }

        document.getElementById('generate').addEventListener('click', async () => {
          const prompt = document.getElementById('prompt').value;
          
          if (!prompt) {
            log('Please enter a prompt');
            return;
          }
          
          log(\`Generating image for prompt: "\${prompt}"...\`);
          resultElement.style.display = 'none';
          spinnerElement.style.display = 'block';
          
          try {
            const response = await fetch('/api/new-gemini-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || \`Server error: \${response.status}\`);
            }
            
            const data = await response.json();
            log('Response received from server');
            
            if (data.error) {
              log(\`Error: \${data.error}\`);
              return;
            }
            
            // Show text response
            if (data.responseText) {
              responseTextElement.textContent = data.responseText;
              log(\`Model response: \${data.responseText.substring(0, 50)}...\`);
            }
            
            // Show image if available
            if (data.imageData) {
              log('Image data received!');
              imageElement.src = data.imageData;
              resultElement.style.display = 'block';
            } else {
              log('No image data received from Gemini');
            }
            
            resultElement.style.display = 'block';
          } catch (error) {
            log(\`Error: \${error.message}\`);
          } finally {
            spinnerElement.style.display = 'none';
          }
        });
      </script>
    </body>
    </html>
  `);
}