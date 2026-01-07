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

// Validate if a player played for both teams and get history
export const validateCrossover = async (team1: string, team2: string, playerName: string): Promise<{ isValid: boolean, history: string[] }> => {
  try {
    const ai = getClient();
    
    // If no AI client available, we cannot validate via AI. 
    if (!ai) {
        console.warn("Gemini API Key missing. Skipping AI validation.");
        return { isValid: false, history: [] };
    }

    const isSameTeam = normalize(team1) === normalize(team2);
    let prompt = `Verify if football player "${playerName}" played for BOTH ${team1} and ${team2} in their senior career. 
    If they did, provide a list of strings indicating the team and the seasons or years they played there (e.g. "Sampdoria 2003-2005").`;
    
    if (isSameTeam) {
        prompt = `Verify if football player "${playerName}" is a "One Club Man" for ${team1} in Serie A (played ONLY for ${team1} and no other major Italian club). 
        If true, provide their career years with the club.`;
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            history: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
        },
      },
    });
    
    const result = JSON.parse(response.text || '{"isValid": false, "history": []}');
    return { isValid: result.isValid, history: result.history || [] };
  } catch (error) {
    console.error("Gemini validation error:", error);
    return { isValid: false, history: [] };
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
    const isSameTeam = t1 === t2;

    for (const [player, data] of Object.entries(db)) {
      const teams = data.teams.map(t => normalize(t));
      
      let isValid = false;

      if (isSameTeam) {
         // One Club Man check: played for target and NO ONE else
         const playedForTarget = teams.some(t => t.includes(t1) || t1.includes(t));
         const playedForOthers = teams.some(t => !(t.includes(t1) || t1.includes(t)));
         isValid = playedForTarget && !playedForOthers;
      } else {
         // Crossover check
         if (teams.some(t => t.includes(t1)) && teams.some(t => t.includes(t2))) {
             isValid = true;
         }
      }

      if (isValid) {
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

    const isSameTeam = normalize(team1) === normalize(team2);
    let prompt = `List up to 5 football players who played for both ${team1} and ${team2} in Serie A history. Return only surnames.`;
    
    if (isSameTeam) {
        prompt = `List up to 5 football players who are iconic "One Club Men" for ${team1} in Serie A (played only for this club in Italy). Return only surnames.`;
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
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