import React, { useState, useCallback } from 'react';
import { Button } from '../components/Button';

// Logic to clean "Atalanta 1993-1994" or "Lecce 2011-2012 (1)" -> "Atalanta"
// Used for the Game Logic (Validation) - Strips EVERYTHING after the name
const cleanTeamName = (rawName: string): string => {
  // Removes years (4 digits), parens, etc to get just the base name
  return rawName.replace(/\s\d{4}.*$/, '').replace(/\s\(\d+.*$/, '').trim();
};

// Logic to clean history display: "Lecce 2011-2012 (1)" -> "Lecce 2011-2012"
// BUT "Ascoli (2004)" -> "Ascoli (2004)" (Preserve year)
const cleanHistoryEntry = (rawName: string): string => {
  // Only remove parens if they contain 1 or 2 digits (e.g. (1), (12))
  // This preserves (1999) or (2000)
  return rawName.replace(/\s*\(\d{1,2}\)$/, '').trim();
};

const DataConverter: React.FC = () => {
  const [stats, setStats] = useState({ files: 0, players: 0 });
  const [jsonOutput, setJsonOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    
    // Structure: Name -> { teams: Set(CleanNames), history: Array(RawStrings) }
    const playerMap: Record<string, { teams: Set<string>, history: string[] }> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      const lines = text.split('\n');

      // Skip header (index 0)
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j];
        if (!line.trim()) continue;

        const cols = line.split(',');
        if (cols.length < 2) continue;

        const rawName = cols[0];
        const rawSquad = cols[1];

        if (rawName && rawSquad) {
          const nameKey = rawName.toLowerCase().trim();
          
          // Use the safer cleaning logic
          const cleanSquad = cleanTeamName(rawSquad);
          const historyEntry = cleanHistoryEntry(rawSquad);

          if (!playerMap[nameKey]) {
            playerMap[nameKey] = {
              teams: new Set(),
              history: []
            };
          }
          
          // Add clean name for game logic
          playerMap[nameKey].teams.add(cleanSquad);
          
          // Add cleaned history entry
          playerMap[nameKey].history.push(historyEntry);
        }
      }
    }

    // Convert Sets to Arrays for final JSON and perform smart deduplication
    const finalDb: Record<string, { teams: string[], history: string[] }> = {};
    Object.keys(playerMap).forEach(key => {
      const rawHistory = playerMap[key].history;
      
      // 1. Remove exact duplicates
      const uniqueHistory = Array.from(new Set(rawHistory));

      // 2. Smart Merge: Remove "Lecce" if "Lecce 2011-2012" exists
      const finalHistory = uniqueHistory.filter(item => {
        const hasYear = /\d{4}/.test(item);
        if (!hasYear) {
           // Check if a more specific version (with year) exists in the list
           const betterVersionExists = uniqueHistory.some(other => 
              other !== item && other.startsWith(item) && /\d{4}/.test(other)
           );
           return !betterVersionExists;
        }
        return true;
      });

      finalDb[key] = {
        teams: Array.from(playerMap[key].teams),
        history: finalHistory.sort() 
      };
    });

    setStats({ files: files.length, players: Object.keys(finalDb).length });
    setJsonOutput(JSON.stringify(finalDb, null, 2));
    setIsProcessing(false);
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonOutput);
    alert("Copied! Now paste this into data/localDb.ts");
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">CSV to Game JSON Converter v2.2</h1>
      <p className="mb-4 text-gray-400">Features: Safer cleaning. Removes (1) but keeps (2004).</p>
      
      <div className="bg-[#1E2732] p-6 rounded-xl border border-gray-700 mb-6">
        <label className="block mb-4">
          <span className="text-gray-300 block mb-2">1. Select all your CSV files</span>
          <input 
            type="file" 
            multiple 
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-[#0066CC] file:text-white
              hover:file:bg-[#0052a3]"
          />
        </label>
        
        {isProcessing && <div className="text-yellow-400">Processing...</div>}
        
        {stats.files > 0 && (
          <div className="text-green-400 mb-4">
            Processed {stats.files} files. Found {stats.players} unique players.
          </div>
        )}

        {jsonOutput && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">2. Result (Clean Teams + Full History)</span>
              <Button onClick={copyToClipboard} variant="primary">
                Copy Full JSON
              </Button>
            </div>
            <textarea 
              readOnly 
              value={jsonOutput} 
              className="w-full h-64 bg-[#0F1419] font-mono text-xs p-4 rounded border border-gray-700 text-green-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataConverter;