import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-flash-preview';

// Validate if a player played for both teams
export const validateCrossover = async (team1: string, team2: string, playerName: string): Promise<boolean> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `True or False: Did football player "${playerName}" play for BOTH ${team1} and ${team2} in their senior career (Serie A context preferred)?`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
          },
        },
      },
    });
    
    const result = JSON.parse(response.text || '{"isValid": false}');
    return result.isValid;
  } catch (error) {
    console.error("Gemini validation error:", error);
    return false;
  }
};

// AI Opponent Logic: Get a list of potential answers to simulate "thinking"
export const getAIAnswers = async (team1: string, team2: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `List up to 5 football players who played for both ${team1} and ${team2} in Serie A history. Return only surnames.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const answers = JSON.parse(response.text || '[]');
    return answers;
  } catch (error) {
    console.error("Gemini AI opponent error:", error);
    return [];
  }
};
