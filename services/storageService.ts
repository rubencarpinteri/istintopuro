export interface MatchRecord {
  date: string;
  opponent: string;
  result: 'WIN' | 'LOSS';
  team: string;
}

export interface UserStats {
  username: string;
  wins: number;
  losses: number;
  matches: MatchRecord[];
}

const STORAGE_KEY = 'calcio_save_data';

export const storageService = {
  getStats: (): UserStats => {
    const data = localStorage.getItem(STORAGE_KEY);
    const username = localStorage.getItem('calcio_username') || 'PLAYER 1';
    
    if (data) {
      const parsed = JSON.parse(data);
      // Ensure username is synced if changed elsewhere
      if (parsed.username !== username) {
          parsed.username = username;
      }
      return parsed;
    }
    
    return {
      username: username,
      wins: 0,
      losses: 0,
      matches: []
    };
  },

  saveMatch: (result: 'WIN' | 'LOSS', opponent: string, team: string) => {
    const stats = storageService.getStats();
    if (result === 'WIN') stats.wins++;
    else stats.losses++;
    
    stats.matches.unshift({
      date: new Date().toISOString(),
      opponent,
      result,
      team
    });
    
    // Keep only last 50 matches to save space
    if (stats.matches.length > 50) stats.matches.pop();
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  },
  
  updateUsername: (name: string) => {
      const stats = storageService.getStats();
      stats.username = name;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
      localStorage.setItem('calcio_username', name);
  },

  // Encodes the JSON state into a Base64 string for portability
  exportData: (): string => {
    const stats = storageService.getStats();
    return btoa(JSON.stringify(stats));
  },

  // Decodes and restores state
  importData: (encoded: string): boolean => {
    try {
      const decoded = atob(encoded);
      const stats = JSON.parse(decoded);
      if (typeof stats.wins === 'number' && Array.isArray(stats.matches)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
        if (stats.username) localStorage.setItem('calcio_username', stats.username);
        return true;
      }
    } catch (e) {
      console.error("Invalid Save Code", e);
    }
    return false;
  }
};