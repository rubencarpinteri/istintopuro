import { validateCrossover as validateWithGemini } from './geminiService';

// Helper to normalize team names for comparison (removes FC, AC, spaces, etc)
// Redefined here to avoid static import of localDb
const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

interface VerificationResult {
  isValid: boolean;
  source: 'LOCAL' | 'AI';
  history?: string[];
}

export const verifyAnswer = async (
  team1: string, 
  team2: string, 
  playerName: string
): Promise<VerificationResult> => {
  const normalizedPlayer = playerName.toLowerCase().trim();
  const normalizedTeam1 = normalize(team1);
  const normalizedTeam2 = normalize(team2);

  // 1. Check Local Database (Dynamically imported to avoid bundle bloat/freeze)
  try {
    const module = await import('../data/localDb');
    const LOCAL_PLAYER_DB = module.LOCAL_PLAYER_DB;

    const playerData = LOCAL_PLAYER_DB[normalizedPlayer];

    if (playerData) {
      const { teams, history } = playerData;
      console.log(`[LocalDB] Found ${normalizedPlayer}:`, teams);
      
      // Check if player has played for both teams using the Cleaned list
      const playedForTeam1 = teams.some(t => normalize(t).includes(normalizedTeam1));
      const playedForTeam2 = teams.some(t => normalize(t).includes(normalizedTeam2));

      if (playedForTeam1 && playedForTeam2) {
        // Filter history to only show relevant teams for this specific matchup to reduce noise
        const relevantHistory = history.filter(h => 
            normalize(h).includes(normalizedTeam1) || normalize(h).includes(normalizedTeam2)
        );

        return { 
          isValid: true, 
          source: 'LOCAL',
          history: relevantHistory.length > 0 ? relevantHistory : history
        };
      } else {
        return { isValid: false, source: 'LOCAL' };
      }
    }
  } catch (error) {
    console.error("Error accessing local DB, falling back to AI:", error);
  }

  // 2. Fallback to Gemini AI
  console.log(`[LocalDB] Player ${normalizedPlayer} not found or DB error. Asking AI...`);
  const aiResult = await validateWithGemini(team1, team2, playerName);
  
  return { 
    isValid: aiResult, 
    source: 'AI' 
  };
};