import { validateCrossover as validateWithGemini } from './geminiService';
import { LOCAL_PLAYER_DB, normalize } from '../data/localDb';

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

  // 1. Check Local Database (Instant & Free)
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

  // 2. Fallback to Gemini AI
  console.log(`[LocalDB] Player ${normalizedPlayer} not found. Asking AI...`);
  const aiResult = await validateWithGemini(team1, team2, playerName);
  
  return { 
    isValid: aiResult, 
    source: 'AI' 
  };
};