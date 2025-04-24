import fetch from "node-fetch";

// Google Gemini 2.0 Flash API URL (as requested)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Function to generate an image from a prompt
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log("DEBUG: Starting image generation process");
    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    
    console.log("DEBUG: API Key exists:", !!apiKey);
    
    if (!apiKey) {
      console.warn("Missing Gemini API key. Using placeholder image.");
      return generatePlaceholderImage(prompt);
    }

    try {
      console.log(`DEBUG: Generating image for prompt: "${prompt}" using Gemini API for keyword extraction`);
      
      // Use the Gemini 2.0 Flash API to get better keywords
      const geminiUrl = `${GEMINI_API_URL}?key=${apiKey}`;
      console.log("DEBUG: Using Gemini URL:", geminiUrl);
      
      // Request payload for Gemini
      const requestBody = {
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
      };
      
      console.log("DEBUG: Request body:", JSON.stringify(requestBody));
      
      // Request to extract keywords with Gemini 2.0 Flash
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("DEBUG: Gemini API response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorData);
        throw new Error(`Gemini API returned error ${response.status}`);
      }

      // Process the response to get keywords
      const responseText = await response.text();
      console.log("DEBUG: Raw Gemini API response:", responseText);
      
      const responseData = JSON.parse(responseText);
      let keywords = prompt; // Default to original prompt if extraction fails
      
      try {
        console.log("DEBUG: Attempting to parse Gemini response");
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
          console.log(`DEBUG: Successfully extracted keywords: ${keywords}`);
        } else {
          console.log("DEBUG: Could not find expected keywords in response structure");
          console.log("DEBUG: Response structure:", JSON.stringify(responseData));
        }
      } catch (parseError) {
        console.error("Error parsing Gemini API keyword response:", parseError);
      }
      
      // Use Picsum to generate a random image
      // Since Unsplash API is not working properly, we'll use LoremPicsum with enhanced styling
      try {
        // Create a unique seed from the keywords to get consistent but varied images
        const seed = createSeedFromKeywords(keywords);
        const width = 1000;
        const height = 600;
        const imageUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
        
        console.log(`DEBUG: Using LoremPicsum with seed "${seed}" derived from keywords: ${keywords}`);
        return imageUrl;
      } catch (error) {
        console.error("Error generating LoremPicsum URL:", error);
        throw error;
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

// Create a seed value from keywords for LoremPicsum
function createSeedFromKeywords(keywords: string): string {
  // Remove special characters and spaces
  let seed = keywords.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Use a hash function to create a more deterministic but varied seed
  // This ensures the same prompt always gives the same image
  // but different prompts likely give different images
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert hash to positive number and to string
  const positiveHash = Math.abs(hash).toString();
  
  // Take specific length for consistency
  seed = positiveHash.substring(0, 10);
  
  // If seed is too short, pad it
  if (seed.length < 5) {
    return seed + "image5000";
  }
  
  return seed;
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
