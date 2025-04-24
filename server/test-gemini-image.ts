import { GoogleGenAI, Modality } from "@google/genai";
import { Request, Response } from "express";

export async function testGeminiImageGeneration(req: Request, res: Response) {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable" });
    }

    console.log(`Testing Gemini image generation with prompt: "${prompt}"`);
    
    try {
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
      
      // Check if we have a response
      if (!response || !response.candidates || response.candidates.length === 0) {
        return res.status(500).json({ 
          error: "Empty response from Gemini API",
          rawResponse: response 
        });
      }
      
      // Variables to store response data
      let responseText = "";
      let imageData = null;
      
      // Extract text and image data from the response
      const firstCandidate = response.candidates?.[0];
      if (firstCandidate?.content?.parts) {
        for (const part of firstCandidate.content.parts) {
          if ('text' in part && part.text) {
            responseText += part.text;
          } else if ('inlineData' in part && part.inlineData?.data) {
            imageData = part.inlineData.data;
          }
        }
      }
      
      // Return the results
      return res.json({
        success: true,
        responseText,
        imageData: imageData ? `data:image/png;base64,${imageData}` : null
      });
      
    } catch (error: any) {
      console.error("Error using Gemini model:", error);
      return res.status(500).json({ 
        error: `Error using Gemini model: ${error.message || 'Unknown error'}`,
        details: error
      });
    }
  } catch (error: any) {
    console.error("Error in test-gemini-image endpoint:", error);
    return res.status(500).json({ 
      error: `Internal server error: ${error.message || 'Unknown error'}`
    });
  }
}