import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-ts-check' });

/**
 * Converts a File object to a Base64 string.
 */
const fileToGenerativePart = async (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        mimeType: file.type,
        data: base64Content,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Performs OCR on the provided image using Gemini 2.5 Flash.
 * Defaults to plain text extraction.
 */
export const performOCR = async (file: File): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(file);

    const prompt = "Please analyze this image and extract all visible text. Return the text as plain text without special formatting.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: imagePart },
          { text: prompt }
        ]
      },
      config: {
        // Lower temperature for more deterministic/accurate extraction
        temperature: 0.2, 
      }
    });

    if (response.text) {
      return response.text;
    }
    
    throw new Error("No text generated from model.");

  } catch (error) {
    console.error("Error performing OCR:", error);
    throw error;
  }
};