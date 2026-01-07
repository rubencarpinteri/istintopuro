import { validateCrossover as validateWithGemini } from './geminiService';

// Helper to normalize team names for comparison
const normalize = (str: string) => {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('sampdroria')) return 'sampdoria';
  return clean;
};

// Helper to title case names
const titleCase = (str: string) => {
  return str.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

interface VerificationResult {
  isValid: boolean;
  source: 'LOCAL' | 'AI';
  history?: string[];
  correctedName?: string;
}

// Get all players who played for both teams from local DB
export const getMatchingPlayers = async (team1: string, team2: string): Promise<string[]> => {
  const normalizedTeam1 = normalize(team1);
  const normalizedTeam2 = normalize(team2);
  const matches: string[] = [];

  try {
    const module = await import('../data/localDb');
    const LOCAL_PLAYER_DB = module.LOCAL_PLAYER_DB;

    for (const [player, data] of Object.entries(LOCAL_PLAYER_DB)) {
      const teams = data.teams.map(t => normalize(t));
      
      // Check if team list contains both target teams
      // using substring match to handle "Hellas Verona" matching "Verona"
      const hasTeam1 = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
      const hasTeam2 = teams.some(t => t.includes(normalizedTeam2) || normalizedTeam2.includes(t));

      if (hasTeam1 && hasTeam2) {
        matches.push(titleCase(player));
      }
    }
  } catch (error) {
    console.error("Error searching local DB:", error);
  }
  
  return matches.sort();
};

export const verifyAnswer = async (
  team1: string, 
  team2: string, 
  userInput: string
): Promise<VerificationResult> => {
  const inputClean = userInput.toLowerCase().trim();
  const normalizedTeam1 = normalize(team1);
  const normalizedTeam2 = normalize(team2);

  // 1. Check Local Database with enhanced matching
  try {
    const module = await import('../data/localDb');
    const LOCAL_PLAYER_DB = module.LOCAL_PLAYER_DB;

    // Iterate through DB to find name match
    for (const [dbName, data] of Object.entries(LOCAL_PLAYER_DB)) {
      
      // Robust Name Matching:
      // 1. Exact match
      // 2. Surname match (dbName ends with input) -> "Luca Toni" ends with "toni"
      // 3. Word match (input matches one of the names) -> "Ronaldo" matches "Cristiano Ronaldo"
      const nameParts = dbName.split(' ');
      const isSurnameMatch = nameParts[nameParts.length - 1] === inputClean;
      const isExactMatch = dbName === inputClean;
      const isWordMatch = nameParts.includes(inputClean);

      if (isExactMatch || isSurnameMatch || isWordMatch) {
        
        // Verify Teams
        const teams = data.teams.map(t => normalize(t));
        const playedForTeam1 = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
        const playedForTeam2 = teams.some(t => t.includes(normalizedTeam2) || normalizedTeam2.includes(t));

        if (playedForTeam1 && playedForTeam2) {
           // Filter history for display. 
           // We try to match the specific seasons to the requested teams.
           // If filtering is too strict and returns empty (e.g. mismatched spellings), we return full history.
           const relevantHistory = data.history.filter(h => {
              const hNorm = normalize(h);
              return hNorm.includes(normalizedTeam1) || hNorm.includes(normalizedTeam2);
           });

           return { 
             isValid: true, 
             source: 'LOCAL',
             // Always prefer relevant history, but fall back to full history to ensure years are shown
             history: relevantHistory.length > 0 ? relevantHistory : data.history,
             correctedName: titleCase(dbName)
           };
        }
      }
    }
  } catch (error) {
    console.error("Error accessing local DB:", error);
  }

  // 2. Fallback to Gemini AI if no local match found
  // Only ask AI if the input looks like a valid name (length > 2)
  if (inputClean.length > 2) {
      console.log(`[Verification] Checking AI for ${userInput}...`);
      const aiResult = await validateWithGemini(team1, team2, userInput);
      return { isValid: aiResult, source: 'AI' };
  }

  return { isValid: false, source: 'LOCAL' };
};