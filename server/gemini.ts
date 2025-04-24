import { GoogleGenerativeAI } from "@google/generative-ai";

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
      console.log(`DEBUG: Generating image for prompt: "${prompt}" using Google Generative AI SDK`);
      
      // Initialize the Gemini API client using the SDK
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // For debugging
      console.log("DEBUG: Successfully initialized GoogleGenerativeAI client");
      
      // Get the model - using gemini-2.0-flash (released after your knowledge cutoff)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // Create the prompt for keyword extraction
      const promptText = `Extract exactly 5 specific and descriptive keywords from this prompt that would be most useful for finding a striking, relevant image: "${prompt}". 
      Return ONLY a comma-separated list of keywords, with no additional text, explanation or formatting.`;
      
      // Configuration for generation
      const generationConfig = {
        temperature: 0.1,
        maxOutputTokens: 50,
        topP: 0.8,
        topK: 10
      };
      
      console.log("DEBUG: Calling Gemini API with SDK...");
      
      // Generate content with Gemini
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig
      });
      
      // Get the response
      const response = result.response;
      console.log("DEBUG: Received response from Gemini API");
      
      // Extract the text content
      let keywords = prompt; // Default to original prompt if extraction fails
      
      if (response && response.text) {
        const text = response.text();
        if (text) {
          keywords = text.trim();
          console.log(`DEBUG: Successfully extracted keywords: ${keywords}`);
        } else {
          console.log("DEBUG: Empty response text from Gemini API");
        }
      } else {
        console.log("DEBUG: Could not extract text from Gemini API response");
      }
      
      // Use Picsum to generate a random image
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
