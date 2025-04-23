import fetch from "node-fetch";

// Stability AI API for image generation
const STABILITY_API_URL = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

// Function to generate an image from a prompt using Stability AI
export async function generateImage(prompt: string): Promise<string> {
  try {
    // Check for API key - we're using Gemini API key but could use a specific Stability key in the future
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("Missing API key. Using placeholder image.");
      return generatePlaceholderImage(prompt);
    }

    try {
      console.log(`Generating image for prompt: "${prompt}" using API`);
      
      // Make request to Stability AI API
      const response = await fetch(STABILITY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
              weight: 1.0
            }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`API error (${response.status}):`, errorData);
        throw new Error(`API returned error ${response.status}`);
      }

      // Process the response
      const responseData = await response.json();
      
      if (!responseData.artifacts || responseData.artifacts.length === 0) {
        throw new Error("No image generated from API");
      }
      
      // Get the base64 image from the response
      const base64Image = responseData.artifacts[0].base64;
      
      // Convert to data URL
      const imageUrl = `data:image/png;base64,${base64Image}`;
      console.log(`Successfully generated image from API for prompt: "${prompt}"`);
      
      return imageUrl;
    } catch (apiError) {
      console.error("API error, falling back to placeholder:", apiError);
      return generatePlaceholderImage(prompt);
    }
  } catch (error) {
    console.error("Error in image generation:", error);
    return generatePlaceholderImage(prompt);
  }
}

// Generate a placeholder image with the prompt text
function generatePlaceholderImage(prompt: string): string {
  const width = 800;
  const height = 600;
  
  // Create a placeholder image URL that includes the prompt
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://placehold.co/${width}x${height}/5D3FD3/FFFFFF?text=${encodedPrompt}`;
  
  console.log(`Generated placeholder image for prompt: "${prompt}"`);
  return imageUrl;
}
