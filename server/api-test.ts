import { Request, Response } from "express";
import { generateImage } from "./gemini-image";

/**
 * Simple test API endpoint to test the image generation function
 */
export async function testImageGeneration(req: Request, res: Response) {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }
    
    console.log(`Testing image generation with prompt: "${prompt}"`);
    
    // Call our image generation function
    const imageResult = await generateImage(prompt);
    
    return res.json({
      success: true,
      imageUrl: imageResult
    });
  } catch (error: any) {
    console.error("Error in test-api endpoint:", error);
    return res.status(500).json({ 
      error: `Internal server error: ${error.message || 'Unknown error'}`
    });
  }
}