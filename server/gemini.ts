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
      console.log(`DEBUG: Generating image for prompt: "${prompt}" using Gemini AI image generation (experimental)`);
      
      // Initialize the Gemini API client using the SDK
      const genAI = new GoogleGenerativeAI(apiKey);
      console.log("DEBUG: Successfully initialized GoogleGenerativeAI client");
      
      // Use the experimental image generation model (gemini-2.0-flash-experimental-vision)
      const imageModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      
      try {
        // Try to generate an image using the experimental API
        console.log("DEBUG: Attempting to use Gemini image generation...");
        
        // Code based on https://ai.google.dev/gemini-api/docs/image-generation#javascript
        const result = await imageModel.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: `Generate an image for the following prompt: ${prompt}. 
                Create a visually striking and high-quality image that accurately represents the prompt.` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          }
        });
        
        const response = await result.response;
        const responseText = response.text();
        console.log("DEBUG: Gemini image generation response:", responseText);
        
        // Example response: "I can't generate that image for you right now"
        if (responseText.toLowerCase().includes("can't generate") || 
            responseText.toLowerCase().includes("cannot generate") ||
            responseText.toLowerCase().includes("unable to generate")) {
          console.log("DEBUG: Gemini image generation not available, falling back to keyword extraction");
          // Fall back to keyword extraction and Picsum if image generation is not available
          return await generateImageWithKeywords(prompt, genAI);
        }
        
        // If we reach here, we should have an image URL or Base64 data in the response
        // Attempt to extract image URL from response
        const urlMatch = responseText.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch) {
          const imageUrl = urlMatch[0];
          console.log("DEBUG: Extracted image URL from Gemini response:", imageUrl);
          return imageUrl;
        }
        
        // Check for base64 data
        const base64Match = responseText.match(/data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+/);
        if (base64Match) {
          const base64Data = base64Match[0];
          console.log("DEBUG: Extracted base64 image data from Gemini response");
          return base64Data;
        }
        
        // If we couldn't extract a usable image, fall back to keyword extraction
        console.log("DEBUG: Could not extract image URL or data from Gemini response, falling back to keyword extraction");
        return await generateImageWithKeywords(prompt, genAI);
        
      } catch (imageGenError) {
        console.error("Error using Gemini image generation:", imageGenError);
        console.log("DEBUG: Falling back to keyword extraction method");
        return await generateImageWithKeywords(prompt, genAI);
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

// Helper function to generate an image using keyword extraction and Picsum
async function generateImageWithKeywords(prompt: string, genAI: any): Promise<string> {
  try {
    // Get the model - using gemini-2.0-flash
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
    
    console.log("DEBUG: Calling Gemini API for keyword extraction...");
    
    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig
    });
    
    // Get the response
    const response = result.response;
    console.log("DEBUG: Received keyword extraction response from Gemini API");
    
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
    // Create a unique seed from the keywords to get consistent but varied images
    const seed = createSeedFromKeywords(keywords);
    const width = 1000;
    const height = 600;
    const imageUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    
    console.log(`DEBUG: Using LoremPicsum with seed "${seed}" derived from keywords: ${keywords}`);
    return imageUrl;
  } catch (error) {
    console.error("Error in keyword extraction:", error);
    throw error;
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
