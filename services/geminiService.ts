import { GoogleGenAI, Type } from "@google/genai";

const MODEL_NAME = 'gemini-3-flash-preview';

const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

// Helper to safely get the AI client only when needed
const getClient = () => {
  const apiKey = process.env.API_KEY;
  // If no key is provided, return null instead of crashing
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Validate if a player played for both teams
export const validateCrossover = async (team1: string, team2: string, playerName: string): Promise<boolean> => {
  try {
    const ai = getClient();
    
    // If no AI client available, we cannot validate via AI. 
    if (!ai) {
        console.warn("Gemini API Key missing. Skipping AI validation.");
        return false;
    }

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

// AI Opponent Logic: Get a list of potential answers using Local DB first, then AI
export const getAIAnswers = async (team1: string, team2: string): Promise<string[]> => {
  const localAnswers: string[] = [];

  // 1. Try Local DB (Primary Strategy)
  try {
    const module = await import('../data/localDb');
    const db = module.LOCAL_PLAYER_DB;
    const t1 = normalize(team1);
    const t2 = normalize(team2);

    for (const [player, data] of Object.entries(db)) {
      const teams = data.teams.map(t => normalize(t));
      // Check if player played for both teams
      if (teams.some(t => t.includes(t1)) && teams.some(t => t.includes(t2))) {
        // Format name: "roberto baggio" -> "Roberto Baggio"
        const formattedName = player.split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        localAnswers.push(formattedName);
      }
    }
    
    if (localAnswers.length > 0) {
      console.log(`[AI Bot] Found ${localAnswers.length} local answers for ${team1} vs ${team2}`);
      // Return randomized subset
      return localAnswers.sort(() => 0.5 - Math.random()).slice(0, 5);
    }
  } catch (e) {
    console.error("Local DB search for AI opponent failed:", e);
  }

  // 2. Fallback to Gemini AI if Local DB yielded nothing
  try {
    const ai = getClient();
    
    if (!ai) {
        console.warn("Gemini API Key missing. AI opponent has no answers.");
        return [];
    }

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