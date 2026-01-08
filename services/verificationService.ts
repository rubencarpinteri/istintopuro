import { validateCrossover as validateWithGemini } from './geminiService';

// Helper to normalize team names for comparison
const normalize = (str: string) => {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('sampdroria')) return 'sampdoria';
  if (clean.includes('chieviverona')) return 'chievoverona';
  return clean;
};

// Helper to title case names
const titleCase = (str: string) => {
  return str.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Helper to filter history strictly to relevant teams
const filterHistory = (history: string[], team1: string, team2: string, isSameTeam: boolean): string[] => {
  const t1 = normalize(team1);
  const t2 = normalize(team2);
  
  return history.filter(h => {
    const hNorm = normalize(h);
    if (isSameTeam) {
      return hNorm.includes(t1);
    }
    return hNorm.includes(t1) || hNorm.includes(t2);
  });
};

// Helper to clean up typos in display
const cleanHistoryText = (history: string[]): string[] => {
  return history.map(h => {
     return h.replace(/Chievi Verona/gi, 'Chievo Verona').replace(/Sampdroria/gi, 'Sampdoria');
  });
};

interface VerificationResult {
  isValid: boolean;
  source: 'LOCAL' | 'AI';
  history?: string[];
  correctedName?: string;
}

// Get all players who played for both teams from local DB
// If team1 == team2, returns players who ONLY played for team1.
export const getMatchingPlayers = async (team1: string, team2: string): Promise<string[]> => {
  const normalizedTeam1 = normalize(team1);
  const normalizedTeam2 = normalize(team2);
  const isSameTeam = normalizedTeam1 === normalizedTeam2;
  const matches: string[] = [];

  try {
    const module = await import('../data/localDb');
    const LOCAL_PLAYER_DB = module.LOCAL_PLAYER_DB;

    for (const [player, data] of Object.entries(LOCAL_PLAYER_DB)) {
      const teams = data.teams.map(t => normalize(t));
      
      if (isSameTeam) {
          // Logic for Same Team: Player must have played for this team AND no others (in this DB)
          const playedForTarget = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
          // Check if there are any teams that DO NOT match the target
          const playedForOthers = teams.some(t => !(t.includes(normalizedTeam1) || normalizedTeam1.includes(t)));
          
          if (playedForTarget && !playedForOthers) {
              matches.push(titleCase(player));
          }
      } else {
          // Standard Logic: Player must have played for both team1 and team2
          const hasTeam1 = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
          const hasTeam2 = teams.some(t => t.includes(normalizedTeam2) || normalizedTeam2.includes(t));

          if (hasTeam1 && hasTeam2) {
            matches.push(titleCase(player));
          }
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
  const isSameTeam = normalizedTeam1 === normalizedTeam2;

  // 1. Check Local Database with enhanced matching
  try {
    const module = await import('../data/localDb');
    const LOCAL_PLAYER_DB = module.LOCAL_PLAYER_DB;

    // Iterate through DB to find name match
    for (const [dbName, data] of Object.entries(LOCAL_PLAYER_DB)) {
      
      // Robust Name Matching:
      // 1. Exact match
      // 2. End Word match (dbName ends with " " + input) -> "Arturo Di Napoli" ends with " Di Napoli"
      // 3. Word match (input matches one of the name parts) -> "Ronaldo" matches "Cristiano Ronaldo"
      const nameParts = dbName.split(' ');
      const isExactMatch = dbName === inputClean;
      const isEndWordMatch = dbName.endsWith(" " + inputClean); 
      const isWordMatch = nameParts.includes(inputClean);

      if (isExactMatch || isEndWordMatch || isWordMatch) {
        
        const teams = data.teams.map(t => normalize(t));
        let isValid = false;

        if (isSameTeam) {
            // "One Club Man" check
            const playedForTarget = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
            const playedForOthers = teams.some(t => !(t.includes(normalizedTeam1) || normalizedTeam1.includes(t)));
            isValid = playedForTarget && !playedForOthers;
        } else {
             // Standard Crossover check
            const playedForTeam1 = teams.some(t => t.includes(normalizedTeam1) || normalizedTeam1.includes(t));
            const playedForTeam2 = teams.some(t => t.includes(normalizedTeam2) || normalizedTeam2.includes(t));
            isValid = playedForTeam1 && playedForTeam2;
        }

        if (isValid) {
           // Strict Filter: Only show history for the relevant teams
           let relevantHistory = filterHistory(data.history, team1, team2, isSameTeam);
           
           // Clean up typos in display
           const displayHistory = cleanHistoryText(relevantHistory);

           return { 
             isValid: true, 
             source: 'LOCAL',
             history: displayHistory,
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
      if (aiResult.isValid) {
        // Also strictly filter AI returned history to prevent full career dumps
        let relevantAiHistory = filterHistory(aiResult.history || [], team1, team2, isSameTeam);
        
        return { 
            isValid: true, 
            source: 'AI',
            history: relevantAiHistory,
            correctedName: aiResult.fullName || userInput.toUpperCase() 
        };
      }
  }

  return { isValid: false, source: 'LOCAL' };
};