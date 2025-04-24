import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

/**
 * Generate an image from a text prompt using Gemini AI
 * 
 * @param {string} prompt - The text prompt to generate an image from
 * @returns {Promise<string>} - URL of the generated image or a base64 data URL
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log(`Generating image for prompt: "${prompt}"`);
    console.log("DEBUG: Starting image generation process with Gemini 2.0 Flash Experimental");
    
    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("Missing Gemini API key. Using placeholder image.");
      return generatePlaceholderImage(prompt);
    }
    
    // Initialize the Google GenAI client
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      // Send the request to generate an image
      console.log("DEBUG: Requesting image generation from Gemini API");
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp-image-generation",
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      
      // Check if we have a response
      if (!response || !response.candidates || response.candidates.length === 0) {
        console.error("DEBUG: Empty response from Gemini API");
        return generateImageFallback(prompt);
      }
      
      // Variables to store response data
      let imageData = null;
      
      // Extract image data from the response
      const firstCandidate = response.candidates?.[0];
      if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
          if (part.inlineData?.data) {
            imageData = part.inlineData.data;
            console.log("DEBUG: Successfully received image data from Gemini");
            
            // Determine if we should save the image to disk or return it as base64
            // For this example, we'll just return the base64 data directly
            return `data:image/png;base64,${imageData}`;
          }
        }
      }
      
      // If we reach here, no image data was found - fall back to keyword extraction
      console.log("DEBUG: No image data in Gemini response, falling back to keyword extraction");
      return generateImageFallback(prompt);
      
    } catch (error) {
      console.error("Error using Gemini model:", error);
      console.log("DEBUG: Falling back to keyword extraction method");
      return generateImageFallback(prompt);
    }
  } catch (error) {
    console.error("Error in image generation:", error);
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Generate an image using keyword extraction and Picsum Photos as a fallback
 * 
 * @param {string} prompt - The text prompt to generate an image from
 * @returns {Promise<string>} - URL of the generated image
 */
async function generateImageFallback(prompt: string): Promise<string> {
  try {
    console.log(`DEBUG: Using fallback image generation for prompt: "${prompt}"`);
    
    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("Missing Gemini API key. Using placeholder image.");
      return generatePlaceholderImage(prompt);
    }
    
    try {
      // Initialize the Gemini API client
      const ai = new GoogleGenAI(apiKey);
      
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
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
      const seed = createSeedFromKeywords(keywords);
      const width = 1000;
      const height = 600;
      const imageUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
      
      console.log(`DEBUG: Using LoremPicsum with seed "${seed}" derived from keywords: ${keywords}`);
      return imageUrl;
    } catch (error) {
      console.error("Error in keyword extraction:", error);
      return generatePlaceholderImage(prompt);
    }
  } catch (error) {
    console.error("Error in fallback image generation:", error);
    return generatePlaceholderImage(prompt);
  }
}

/**
 * Create a seed value from keywords for LoremPicsum
 */
function createSeedFromKeywords(keywords: string): string {
  // Remove special characters and spaces
  let seed = keywords.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Use a hash function to create a more deterministic but varied seed
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