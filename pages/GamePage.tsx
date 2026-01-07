import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { TeamCard } from '../components/TeamCard';
import { TEAMS } from '../constants';
import { GameState, Team } from '../types';
import { getAIAnswers } from '../services/geminiService';
import { verifyAnswer, getMatchingPlayers } from '../services/verificationService';

// Color generator for teams not in constants
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>(GameState.SELECTION);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [inputValue, setInputValue] = useState('');
  
  // Data State
  const [availableTeams, setAvailableTeams] = useState<Team[]>(TEAMS);
  const [teamFilter, setTeamFilter] = useState('');
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Update message state to include optional history array
  const [messages, setMessages] = useState<{
    text: string, 
    isError?: boolean, 
    isSuccess?: boolean, 
    source?: string,
    history?: string[] 
  }[]>([]);
  
  const [scores, setScores] = useState({ user: 0, opponent: 0 });
  const [possibleAnswersCount, setPossibleAnswersCount] = useState<number | null>(null);
  
  // Refs for AI behavior
  const aiPotentialAnswers = useRef<string[]>([]);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load DB and extract all teams
  useEffect(() => {
    import('../data/localDb').then((module) => {
        const db = module.LOCAL_PLAYER_DB;
        const uniqueTeamNames = new Set<string>();
        
        // 1. Extract all unique team names from the DB
        Object.values(db).forEach((player: any) => {
            if (Array.isArray(player.teams)) {
                player.teams.forEach((t: string) => {
                    const tLower = t.toLowerCase();
                    // Typo fix on the fly for the list
                    if (tLower !== 'sampdroria' && tLower !== 'chievi verona') {
                        uniqueTeamNames.add(t);
                    }
                });
            }
        });

        // 2. Convert to Team objects, preserving existing colors if possible
        const allDbTeams: Team[] = Array.from(uniqueTeamNames).map(name => {
            // Check if we have a preset configuration for this team
            const preset = TEAMS.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (preset) return preset;

            // Otherwise generate a consistent color
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                name: name,
                colors: [generateColor(name), '#000000'] // Generated + Black
            };
        });

        // 3. Sort alphabetically
        allDbTeams.sort((a, b) => a.name.localeCompare(b.name));

        setAvailableTeams(allDbTeams);
        setIsDbLoaded(true);
        console.log("Local DB teams loaded:", allDbTeams.length);

    }).catch(e => console.error("Failed to preload DB", e));
  }, []);

  // Timer Effect
  useEffect(() => {
    if (gameState === GameState.SELECTION && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameState === GameState.SELECTION && timeLeft === 0) {
      handleAutoSelect();
    }
  }, [gameState, timeLeft]);

  // AI Selection & Setup Effect
  useEffect(() => {
    if (gameState === GameState.SELECTION && availableTeams.length > 0) {
      // Pick random opponent from ALL available teams
      const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      setOpponentTeam(randomTeam);
    }
  }, [gameState, availableTeams]);

  // Game Start Effect
  useEffect(() => {
    if (gameState === GameState.PLAYING && userTeam && opponentTeam) {
      setTimeout(() => inputRef.current?.focus(), 100);
      checkPossibilitiesAndStart(userTeam.name, opponentTeam.name);
    }
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [gameState]);

  const handleAutoSelect = () => {
    if (!userTeam && availableTeams.length > 0) {
      const random = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      setUserTeam(random);
    }
    startReveal();
  };

  const startReveal = () => {
    setGameState(GameState.REVEAL);
    let count = 3;
    const revealInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(revealInterval);
        setGameState(GameState.PLAYING);
      }
    }, 1000);
  };

  const checkPossibilitiesAndStart = async (team1: string, team2: string) => {
    // 1. Check total possibilities first
    const allMatches = await getMatchingPlayers(team1, team2);
    setPossibleAnswersCount(allMatches.length);

    if (allMatches.length === 0) {
        setMessages([{ 
            text: `⚠️ Impossible Matchup! No players found who played for ${team1 === team2 ? 'ONLY ' + team1 : 'both ' + team1 + ' and ' + team2} in our database.`, 
            isError: true 
        }]);
        // Allow proceeding to next round without points
        setGameState(GameState.ROUND_END);
        return;
    }

    // 2. Start AI Turn
    const answers = await getAIAnswers(team1, team2);
    aiPotentialAnswers.current = answers;

    if (answers.length > 0) {
      // AI "thinks" between 10 and 35 seconds
      const thinkTime = Math.random() * 25000 + 10000;
      gameLoopRef.current = setTimeout(() => {
        // AI picks one answer
        handleAIWin(answers[0]);
      }, thinkTime);
    }
  };

  const handleAIWin = async (answer: string) => {
    // Calculate stats before showing message
    let extraText = '';
    let history: string[] | undefined = [];

    if (userTeam && opponentTeam) {
        try {
            const allMatches = await getMatchingPlayers(userTeam.name, opponentTeam.name);
            const total = allMatches.length;
            
            // Check if the AI's answer is in the list
            const isAnswerInDb = allMatches.some(p => p.toLowerCase() === answer.toLowerCase());
            const remaining = isAnswerInDb ? total - 1 : total;
            
            if (remaining > 0) {
                extraText = ` (and ${remaining} more!)`;
            }

            // Retrieve history for AI answer so seasons are shown
            const verifyResult = await verifyAnswer(userTeam.name, opponentTeam.name, answer);
            if (verifyResult.isValid && verifyResult.history) {
              history = verifyResult.history;
            }
        } catch (e) {
            console.error(e);
        }
    }

    setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    setMessages(prev => [...prev, { 
      text: `🤖 AI answered: ${answer} ✅${extraText}`, 
      isError: true, 
      history: history 
    }]);
    setGameState(GameState.ROUND_END);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !userTeam || !opponentTeam) return;

    const rawInput = inputValue.trim();
    setInputValue('');
    
    // UI Feedback immediately
    setMessages(prev => [...prev, { text: `Checking ${rawInput}...` }]);

    // 1. Optimistic check: Did AI already find this player?
    // Even if AI found it, we WANT to fetch the history from DB to show the years.
    const isKnownValid = aiPotentialAnswers.current.some(a => 
        a.toLowerCase().includes(rawInput.toLowerCase()) || 
        rawInput.toLowerCase().includes(a.toLowerCase())
    );
    
    // 2. Full Verification (Local DB -> then AI)
    // We run verification regardless of isKnownValid to ensure we get the history data from DB
    const result = await verifyAnswer(userTeam.name, opponentTeam.name, rawInput);

    if (result.isValid) {
      // Use the corrected name from DB (e.g. "Luca Toni" if user typed "Toni")
      const displayName = result.correctedName || rawInput;
      handleSuccess(displayName, result.source || 'Verified', result.history);
    } else if (isKnownValid) {
       // Fallback: If verification failed (weird typo?) but AI knew it, accept it without history
       const matchName = aiPotentialAnswers.current.find(a => a.toLowerCase().includes(rawInput.toLowerCase())) || rawInput;
       handleSuccess(matchName, 'AI Match', []);
    } else {
      setMessages(prev => [...prev, { text: `❌ ${rawInput} is incorrect`, isError: true }]);
    }
  };

  const handleSuccess = (answer: string, source: string, history?: string[]) => {
    setScores(prev => ({ ...prev, user: prev.user + 1 }));
    setMessages(prev => [...prev, { 
      text: `GOAL! ${answer} is correct!`, 
      isSuccess: true,
      source,
      history
    }]);
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    setGameState(GameState.ROUND_END);
  };

  const nextRound = () => {
    setUserTeam(null);
    // Pick new random opponent
    if (availableTeams.length > 0) {
        setOpponentTeam(availableTeams[Math.floor(Math.random() * availableTeams.length)]);
    }
    setMessages([]);
    setPossibleAnswersCount(null);
    setTimeLeft(30);
    setTeamFilter('');
    setGameState(GameState.SELECTION);
  };

  const filteredTeams = useMemo(() => {
    if (!teamFilter) return availableTeams;
    return availableTeams.filter(t => t.name.toLowerCase().includes(teamFilter.toLowerCase()));
  }, [availableTeams, teamFilter]);

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto p-4 relative z-10">
      {/* Scoreboard */}
      <div className="flex items-center justify-between mb-6 bg-[#1E2732] p-4 rounded-2xl border border-gray-800 shadow-lg">
        <div className="text-center w-1/3">
          <p className="text-xs text-gray-400 uppercase font-bold">You</p>
          <p className="text-3xl font-mono font-bold text-[#0066CC]">{scores.user}</p>
        </div>
        <div className="w-px h-10 bg-gray-700"></div>
        <div className="text-center w-1/3">
          <p className="text-xs text-gray-400 uppercase font-bold">Opponent</p>
          <p className="text-3xl font-mono font-bold text-red-500">{scores.opponent}</p>
        </div>
      </div>

      {/* PHASE: SELECTION */}
      {gameState === GameState.SELECTION && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="text-center mb-4 shrink-0">
            <h2 className="text-2xl font-bold mb-1">Select Your Team</h2>
            <div className="inline-block bg-[#0F1419] border border-[#0066CC] text-[#0066CC] px-4 py-1 rounded-full font-mono font-bold text-sm mb-3">
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
            
            {/* Search Bar */}
            <input 
                type="text"
                placeholder="Search teams..."
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full bg-[#1E2732] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0066CC] transition-colors"
            />
          </div>

          {/* Teams Grid - Denser for visibility */}
          <div className="flex-1 overflow-y-auto min-h-0 mb-4 pr-1">
             {!isDbLoaded && (
                 <div className="text-center py-8 text-gray-500 animate-pulse">Loading all teams from database...</div>
             )}
             
             <div className="grid grid-cols-3 gap-2">
                {filteredTeams.map(team => (
                <TeamCard 
                    key={team.id}
                    team={team}
                    selected={userTeam?.id === team.id}
                    onClick={() => setUserTeam(team)}
                    compact={true}
                />
                ))}
            </div>
            {filteredTeams.length === 0 && isDbLoaded && (
                <div className="text-center py-8 text-gray-500">No teams found matching "{teamFilter}"</div>
            )}
          </div>

          <div className="shrink-0 pt-2 pb-6">
            <Button fullWidth onClick={startReveal} disabled={!userTeam}>Confirm Selection</Button>
          </div>
        </div>
      )}

      {/* PHASE: REVEAL */}
      {gameState === GameState.REVEAL && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-pulse">
          <h2 className="text-3xl font-bold">MATCHUP</h2>
          <div className="w-full flex items-center justify-between px-4">
             <div className="text-center w-5/12">
                <div className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-xl mx-auto flex items-center justify-center text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${userTeam?.colors[0]}, ${userTeam?.colors[1]})` }}>
                    {/* Fallback if no logo, just color */}
                </div>
                <p className="font-bold text-lg leading-tight">{userTeam?.name}</p>
             </div>
             <div className="text-2xl font-mono font-bold text-gray-500">VS</div>
             <div className="text-center w-5/12">
                <div className="w-20 h-20 rounded-full mb-3 border-4 border-white shadow-xl mx-auto flex items-center justify-center text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${opponentTeam?.colors[0]}, ${opponentTeam?.colors[1]})` }}>
                </div>
                <p className="font-bold text-lg leading-tight">{opponentTeam?.name}</p>
             </div>
          </div>
        </div>
      )}

      {/* PHASE: PLAYING */}
      {(gameState === GameState.PLAYING || gameState === GameState.ROUND_END) && (
        <div className="flex-1 flex flex-col min-h-0">
           <div className="bg-[#1E2732] rounded-xl p-4 mb-4 border border-gray-700 flex justify-between items-center shadow-md shrink-0">
              <div className="flex items-center gap-2 max-w-[40%]">
                <div className="w-8 h-8 rounded-full shrink-0 border border-white/20" style={{ background: userTeam?.colors[0] }} />
                <span className="font-bold truncate text-sm">{userTeam?.name}</span>
              </div>
              <span className="text-gray-500 font-mono text-[10px] uppercase px-2">Crossover</span>
              <div className="flex items-center gap-2 max-w-[40%] justify-end">
                <span className="font-bold truncate text-sm text-right">{opponentTeam?.name}</span>
                <div className="w-8 h-8 rounded-full shrink-0 border border-white/20" style={{ background: opponentTeam?.colors[0] }} />
              </div>
           </div>

           <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-1 min-h-0">
              {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-10 text-sm">
                      {possibleAnswersCount === 0 
                        ? "Checking database..." 
                        : "Waiting for your answer..."}
                  </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm font-medium flex flex-col ${
                    msg.isSuccess ? 'bg-green-500/20 text-green-200 border border-green-500/50' : 
                    msg.isError ? 'bg-red-500/20 text-red-200 border border-red-500/50' : 
                    'bg-gray-800 text-gray-300'
                  }`}>
                  <div className="flex justify-between items-center w-full">
                    <span>{msg.text}</span>
                    {msg.source && <span className="text-[10px] opacity-75 font-mono border border-current px-1 rounded ml-2 whitespace-nowrap">{msg.source === 'LOCAL' ? '⚡ DB' : '🤖 AI'}</span>}
                  </div>
                  {/* Display History if available */}
                  {msg.history && msg.history.length > 0 && (
                    <div className="mt-2 pl-2 border-l-2 border-current text-xs opacity-90 space-y-1">
                      {msg.history.map((h, i) => (
                        <div key={i}>{h}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
           </div>

           {gameState === GameState.PLAYING ? (
             <form onSubmit={handleUserSubmit} className="mt-auto shrink-0 pb-4">
               <div className="relative">
                 <input
                   ref={inputRef}
                   type="text"
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   disabled={possibleAnswersCount === 0}
                   className="w-full bg-[#0F1419] border-2 border-[#0066CC] rounded-xl px-4 py-4 text-lg font-bold text-white focus:outline-none focus:ring-4 focus:ring-[#0066CC]/30 placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                   placeholder={possibleAnswersCount === 0 ? "No answers possible" : "Type surname..."}
                   autoComplete="off"
                   autoFocus
                 />
                 <button type="submit" disabled={possibleAnswersCount === 0} className="absolute right-2 top-2 bottom-2 bg-[#0066CC] px-4 rounded-lg font-bold shadow-lg disabled:opacity-50">GO</button>
               </div>
             </form>
           ) : (
             <div className="mt-auto space-y-3 shrink-0 pb-6">
               <div className="bg-[#1E2732] p-4 rounded-xl text-center border border-gray-700">
                 <h3 className="text-xl font-bold text-white">
                   {messages.find(m => m.isSuccess) ? 'Point for You!' : (possibleAnswersCount === 0 ? 'Draw (No Players)' : 'Point for AI')}
                 </h3>
               </div>
               <div className="grid grid-cols-2 gap-3">
                    <Button fullWidth onClick={nextRound}>Next Round</Button>
                    <Button fullWidth variant="secondary" onClick={() => navigate('/')}>Back to Menu</Button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GamePage;