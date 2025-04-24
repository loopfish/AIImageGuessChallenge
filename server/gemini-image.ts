import { GoogleGenAI, Modality } from "@google/genai";
import { Request, Response } from "express";

/**
 * Generate an image using Gemini for the game prompt
 * 
 * This function uses the Gemini 2.0 Flash experimental model to generate an image
 * based on the provided prompt. If image generation fails, it falls back to a
 * placeholder image service.
 * 
 * @param prompt Text prompt to generate an image from
 * @returns URL or data URI of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log(`Generating image for prompt: "${prompt}"`);
    
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Missing GEMINI_API_KEY environment variable");
      return generatePlaceholderImage(prompt);
    }
    
    // Initialize the Google GenAI client
    const ai = new GoogleGenAI({ apiKey });
    
    // Send the request to generate an image
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    
    // Check if we have a valid response
    if (!response || !response.candidates || response.candidates.length === 0) {
      console.error("Empty response from Gemini API");
      return generateFallbackImage(prompt);
    }
    
    // Extract image data from the response
    let imageData = null;
    const firstCandidate = response.candidates?.[0];
    
    if (firstCandidate?.content?.parts) {
      for (const part of firstCandidate.content.parts) {
        if ('inlineData' in part && part.inlineData?.data) {
          imageData = part.inlineData.data;
          console.log("Successfully received image data from Gemini");
          return `data:image/png;base64,${imageData}`;
        }
      }
    }
    
    // If no image data was found, fall back to placeholder
    console.log("No image data in Gemini response");
    return generateFallbackImage(prompt);
    
  } catch (error) {
    console.error("Error using Gemini model:", error);
    return generateFallbackImage(prompt);
  }
}

/**
 * Generate a fallback image URL based on the prompt
 */
function generateFallbackImage(prompt: string): string {
  try {
    // Create a seed value based on the prompt
    const seed = createSeedFromPrompt(prompt);
    const width = 1000;
    const height = 600;
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
  } catch (error) {
    console.error("Error generating fallback image:", error);
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Create a seed value from a prompt for LoremPicsum
 */
function createSeedFromPrompt(prompt: string): string {
  // Remove special characters and spaces
  let seed = prompt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Use a hash function to create a deterministic but varied seed
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

/**
 * Generate a placeholder image with the prompt text
 */
function generatePlaceholderImage(prompt: string): string {
  const width = 800;
  const height = 600;
  
  // Create a placeholder image URL that includes the prompt
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://placehold.co/${width}x${height}/5D3FD3/FFFFFF?text=${encodedPrompt}`;
  
  console.log(`Generated placeholder image for prompt: "${prompt}"`);
  return imageUrl;
}