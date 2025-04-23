import fetch from "node-fetch";

// Google Gemini 2.0 Flash API URL (as requested)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Unsplash API for retrieving relevant images based on prompt
const UNSPLASH_API_URL = "https://source.unsplash.com/random?";

// Function to generate an image from a prompt
export async function generateImage(prompt: string): Promise<string> {
  try {
    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("Missing Gemini API key. Using placeholder image.");
      return generatePlaceholderImage(prompt);
    }

    try {
      console.log(`Generating image for prompt: "${prompt}" using Gemini API for keyword extraction`);
      
      // Use the Gemini 2.0 Flash API to get better keywords
      const geminiUrl = `${GEMINI_API_URL}?key=${apiKey}`;
      
      // Request to extract keywords with Gemini 2.0 Flash
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extract exactly 5 specific and descriptive keywords from this prompt that would be most useful for finding a striking, relevant image: "${prompt}". 
              Return ONLY a comma-separated list of keywords, with no additional text, explanation or formatting.`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50,
            topP: 0.8,
            topK: 10
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorData);
        throw new Error(`Gemini API returned error ${response.status}`);
      }

      // Process the response to get keywords
      const responseData = await response.json() as any;
      let keywords = prompt; // Default to original prompt if extraction fails
      
      try {
        // Safely access nested properties with proper type checking
        if (responseData && 
            typeof responseData === 'object' &&
            responseData.candidates && 
            Array.isArray(responseData.candidates) &&
            responseData.candidates[0] && 
            typeof responseData.candidates[0] === 'object' &&
            responseData.candidates[0].content && 
            typeof responseData.candidates[0].content === 'object' &&
            responseData.candidates[0].content.parts &&
            Array.isArray(responseData.candidates[0].content.parts) &&
            responseData.candidates[0].content.parts[0] &&
            typeof responseData.candidates[0].content.parts[0] === 'object' &&
            responseData.candidates[0].content.parts[0].text &&
            typeof responseData.candidates[0].content.parts[0].text === 'string') {
          
          // Get the extracted keywords
          keywords = responseData.candidates[0].content.parts[0].text.trim();
          console.log(`Extracted keywords: ${keywords}`);
        }
      } catch (parseError) {
        console.error("Error parsing Gemini API keyword response:", parseError);
      }
      
      // Now fetch an image from Unsplash using the keywords
      try {
        // Create URL-safe query string
        const query = encodeURIComponent(keywords);
        const imageUrl = `${UNSPLASH_API_URL}${query}`;
        
        // Unsplash API will redirect to a random image matching the query
        const imageResponse = await fetch(imageUrl, { 
          method: 'GET',
          redirect: 'follow'
        });
        
        if (imageResponse.ok) {
          // Get the final URL after redirects (this is the actual image URL)
          const finalImageUrl = imageResponse.url;
          console.log(`Successfully retrieved image from Unsplash for prompt: "${prompt}"`);
          return finalImageUrl;
        } else {
          throw new Error(`Unsplash API returned error ${imageResponse.status}`);
        }
      } catch (unsplashError) {
        console.error("Error fetching image from Unsplash:", unsplashError);
        throw unsplashError;
      }
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
