import { validateCrossover as validateWithGemini } from './geminiService';

// Helper to normalize team names for comparison
// FIX: Automatically maps the known typo "sampdroria" to "sampdoria"
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
      
      if (teams.some(t => t.includes(normalizedTeam1)) && teams.some(t => t.includes(normalizedTeam2))) {
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

    // Search for ANY player in the DB that matches criteria
    for (const [dbName, data] of Object.entries(LOCAL_PLAYER_DB)) {
      
      // Check Name Match:
      // 1. Exact match (e.g. "luca toni")
      // 2. Surname match (e.g. "toni" matches "luca toni")
      const nameParts = dbName.split(' ');
      const surname = nameParts[nameParts.length - 1];
      
      const isNameMatch = dbName === inputClean || surname === inputClean;

      if (isNameMatch) {
        // Check Teams Match
        const teams = data.teams.map(t => normalize(t));
        const playedForTeam1 = teams.some(t => t.includes(normalizedTeam1));
        const playedForTeam2 = teams.some(t => t.includes(normalizedTeam2));

        if (playedForTeam1 && playedForTeam2) {
           // Filter history for display
           const relevantHistory = data.history.filter(h => 
              normalize(h).includes(normalizedTeam1) || normalize(h).includes(normalizedTeam2)
           );

           return { 
             isValid: true, 
             source: 'LOCAL',
             history: relevantHistory.length > 0 ? relevantHistory : data.history,
             correctedName: titleCase(dbName)
           };
        }
      }
    }
    
    // If we finished the loop and found a name match but they didn't play for both teams,
    // we return false immediately (don't ask AI if we know the player exists but is wrong).
    // However, to be safe, we just fall through if no *valid* crossover was found.

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