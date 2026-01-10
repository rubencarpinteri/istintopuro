import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { TeamCard } from '../components/TeamCard';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { TEAMS } from '../constants';
import { GameState, Team } from '../types';
import { getAIAnswers } from '../services/geminiService';
import { verifyAnswer, getMatchingPlayers } from '../services/verificationService';
import { p2pManager } from '../services/p2pService';

// Color generator for teams not in constants (fallback)
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// Helper to sort history chronologically
const sortHistory = (history: string[]) => {
  return [...history].sort((a, b) => {
    const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0');
    const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0');
    return yearA - yearB;
  });
};

interface GameMessage {
  text?: string;        
  prefix?: string;      
  highlight?: string;   
  suffix?: string;      
  isError?: boolean;
  isSuccess?: boolean;
  isCpuWin?: boolean;   
  source?: string;
  history?: string[];
}

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isP2P = searchParams.get('mode') === 'p2p';

  const [gameState, setGameState] = useState<GameState>(GameState.SELECTION);
  
  // Selection State
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null); // Visual focus
  const [userTeam, setUserTeam] = useState<Team | null>(null); // Confirmed selection
  
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [inputValue, setInputValue] = useState('');
  
  // Data State
  const [availableTeams, setAvailableTeams] = useState<Team[]>(TEAMS);
  const [teamFilter, setTeamFilter] = useState('');
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Gameplay State
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [scores, setScores] = useState({ user: 0, opponent: 0 });
  const [possibleAnswersCount, setPossibleAnswersCount] = useState<number | null>(null);
  
  // Refs
  const aiPotentialAnswers = useRef<string[]>([]);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Refs for race condition handling
  const isUserValidating = useRef(false);
  const aiPendingWin = useRef<string | null>(null);

  // P2P Listeners
  useEffect(() => {
    if (!isP2P) return;

    // Listen for P2P messages
    const removeListener = p2pManager.onMessage((msg) => {
        if (msg.type === 'TEAM_SELECT') {
            // Host sent the teams
            const { team1Id, team2Id } = msg.payload;
            const t1 = availableTeams.find(t => t.id === team1Id);
            const t2 = availableTeams.find(t => t.id === team2Id);
            
            if (t1 && t2) {
                // If I am guest, I receive the selection. 
                // Host selected t1, so that's "their" team (opponent for me), but in this game
                // we share the challenge. So I just set them for visual.
                // Wait, logic:
                // User selects TEAM A. Opponent gets assigned TEAM B.
                // In P2P, Host selects TEAM A. 
                // Then Host machine randomizes TEAM B.
                // Host sends { team1: A, team2: B } to Guest.
                setUserTeam(t1);
                setOpponentTeam(t2);
                
                // Trigger reveal on guest side
                setGameState(GameState.REVEAL);
                setTimeout(() => {
                   setGameState(GameState.PLAYING);
                   // Guest doesn't need to check AI answers, but needs validation DB.
                   // Validation DB is loaded in effect.
                   getMatchingPlayers(t1.name, t2.name).then(matches => {
                       setPossibleAnswersCount(matches.length);
                   });
                }, 4000); // 1s delay + 3s reveal
            }
        } 
        else if (msg.type === 'SCORE_UPDATE') {
            // Opponent scored!
            const { answer, history } = msg.payload;
            setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
            setMessages(prev => [...prev, { 
                prefix: `> ${p2pManager.opponentName} found: `,
                highlight: answer.toUpperCase(),
                isCpuWin: true, // Reusing style for opponent
                history: history
            }]);
            
            // In P2P "Race", the round continues until time up or someone quits?
            // Or "First to find X"?
            // Let's stick to standard round reset for simplicity:
            // Whoever finds first, wins round.
            setGameState(GameState.ROUND_END);
        }
    });

    return () => removeListener();
  }, [isP2P, availableTeams]);

  // Load DB and extract all teams
  useEffect(() => {
    import('../data/localDb').then((module) => {
        const db = module.LOCAL_PLAYER_DB;
        const uniqueTeamNames = new Set<string>();
        
        Object.values(db).forEach((player: any) => {
            if (Array.isArray(player.teams)) {
                player.teams.forEach((t: string) => {
                    const tLower = t.toLowerCase();
                    if (tLower !== 'sampdroria' && tLower !== 'chievi verona') {
                        uniqueTeamNames.add(t);
                    }
                });
            }
        });

        const allDbTeams: Team[] = Array.from(uniqueTeamNames).map(name => {
            const preset = TEAMS.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (preset) return preset;

            return {
                id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                name: name,
                colors: [generateColor(name), '#333333'] 
            };
        });

        allDbTeams.sort((a, b) => a.name.localeCompare(b.name));

        setAvailableTeams(allDbTeams);
        setIsDbLoaded(true);

    }).catch(e => console.error("Failed to preload DB", e));
  }, []);

  // Timer Effect (Only Host controls Selection timer logic effectively, or local)
  useEffect(() => {
    if (gameState === GameState.SELECTION && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameState === GameState.SELECTION && timeLeft === 0) {
      if (!isP2P || p2pManager.isHost) {
          handleAutoSelect();
      }
    }
  }, [gameState, timeLeft, isP2P]);

  // AI Selection & Setup Effect (Only run if single player OR Host)
  useEffect(() => {
    if (gameState === GameState.SELECTION && availableTeams.length > 0) {
      if (!isP2P || p2pManager.isHost) {
          const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
          setOpponentTeam(randomTeam);
      }
    }
  }, [gameState, availableTeams, isP2P]);

  // Game Start Effect
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        setInputValue(''); 
        isUserValidating.current = false;
        aiPendingWin.current = null;
    }

    if (gameState === GameState.PLAYING && userTeam && opponentTeam) {
      if (isP2P) {
          // P2P Mode: Just check counts, don't run AI
          getMatchingPlayers(userTeam.name, opponentTeam.name).then(matches => {
              setPossibleAnswersCount(matches.length);
              if (matches.length === 0) {
                   setMessages([{ text: `NO MATCHES FOUND. SKIP.`, isError: true }]);
                   setTimeout(nextRound, 2000);
              }
          });
      } else {
          // AI Mode
          checkPossibilitiesAndStart(userTeam.name, opponentTeam.name);
      }
    }
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [gameState]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Physical Keyboard Listener
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        // Allow browser hotkeys
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            handleUserSubmit();
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            setInputValue(prev => prev.slice(0, -1));
        } else if (/^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            setInputValue(prev => prev + e.key.toUpperCase());
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, inputValue, userTeam, opponentTeam]);

  // ---- Interaction Logic ----

  const handleTeamInteraction = (team: Team) => {
    // Only Host can select in P2P selection phase
    if (isP2P && !p2pManager.isHost) return;
    if (userTeam) return;

    if (focusedTeamId === team.id) {
        confirmSelection(team);
    } else {
        setFocusedTeamId(team.id);
    }
  };

  const confirmSelection = (team: Team) => {
    setUserTeam(team);
    setFocusedTeamId(team.id); 
    
    if (isP2P && p2pManager.isHost) {
        // Generate random opponent team if not set
        const oppTeam = opponentTeam || availableTeams[Math.floor(Math.random() * availableTeams.length)];
        setOpponentTeam(oppTeam);

        // Send to guest
        p2pManager.send('TEAM_SELECT', { 
            team1Id: team.id,
            team2Id: oppTeam.id
        });
    }

    setTimeout(() => startReveal(), 600);
  };

  const handleRandomSelect = () => {
    if (availableTeams.length > 0) {
        const candidates = filteredTeams.length > 0 ? filteredTeams : availableTeams;
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        confirmSelection(random);
    }
  };

  const handleAutoSelect = () => {
    if (!userTeam) {
      if (focusedTeamId) {
          const focused = availableTeams.find(t => t.id === focusedTeamId);
          if (focused) confirmSelection(focused);
      } else {
          const random = availableTeams[Math.floor(Math.random() * availableTeams.length)];
          confirmSelection(random);
      }
    }
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
    const allMatches = await getMatchingPlayers(team1, team2);
    setPossibleAnswersCount(allMatches.length);

    if (allMatches.length === 0) {
        setMessages([{ 
            text: `*** MATCH ABANDONED ***\nNo players found for ${team1} + ${team2}.`, 
            isError: true 
        }]);
        setGameState(GameState.ROUND_END);
        return;
    }

    // AI Logic only in Single Player
    const answers = await getAIAnswers(team1, team2);
    aiPotentialAnswers.current = answers;

    if (answers.length > 0) {
      const thinkTime = Math.random() * 25000 + 10000;
      gameLoopRef.current = setTimeout(() => {
        if (isUserValidating.current) {
            aiPendingWin.current = answers[0];
        } else {
            handleAIWin(answers[0]);
        }
      }, thinkTime);
    }
  };

  const handleAIWin = async (answer: string) => {
    let history: string[] | undefined = [];

    if (userTeam && opponentTeam) {
        try {
            const verifyResult = await verifyAnswer(userTeam.name, opponentTeam.name, answer);
            if (verifyResult.isValid && verifyResult.history) {
              history = sortHistory(verifyResult.history);
            }
        } catch (e) {
            console.error(e);
        }
    }

    setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    setMessages(prev => [...prev, { 
      prefix: "> CPU scores with ",
      highlight: answer.toUpperCase() + "!",
      isCpuWin: true,
      history: history 
    }]);
    setGameState(GameState.ROUND_END);
  };

  const handleSurrender = async () => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    
    // In P2P, surrender gives point to opponent
    setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    
    setMessages(prev => [...prev, { text: "> ROUND SURRENDERED.", isError: true }]);
    setGameState(GameState.ROUND_END);
  };

  const handleUserSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !userTeam || !opponentTeam) return;

    isUserValidating.current = true;
    const rawInput = inputValue.trim();
    setInputValue('');
    const inputClean = rawInput.toLowerCase();
    
    setMessages(prev => [...prev, { text: `> Analyzing: ${rawInput}...` }]);

    // In P2P, we rely purely on Local DB for fairness, AI fallback is disabled for speed/sync
    const result = await verifyAnswer(userTeam.name, opponentTeam.name, rawInput);
    isUserValidating.current = false;

    if (result.isValid) {
      const displayName = result.correctedName || rawInput;
      handleSuccess(displayName, result.source || 'DB', result.history);
      
      // Notify Opponent
      if (isP2P) {
          p2pManager.send('SCORE_UPDATE', {
              answer: displayName,
              history: result.history
          });
      }

    } else {
      setMessages(prev => [...prev, { text: `> REJECTED: ${rawInput} is not valid.`, isError: true }]);
      // In Single player, this might trigger AI win if race condition
      if (!isP2P && aiPendingWin.current) {
          handleAIWin(aiPendingWin.current);
          aiPendingWin.current = null;
      }
    }
  };

  const handleSuccess = async (answer: string, source: string, history?: string[]) => {
    let sortedHistory: string[] = [];
    if (userTeam && opponentTeam) {
        if (history) {
            sortedHistory = sortHistory(history);
        }
    }

    setScores(prev => ({ ...prev, user: prev.user + 1 }));
    setMessages(prev => [...prev, { 
      prefix: "> GOAL! ",
      highlight: answer.toUpperCase() + "!",
      isSuccess: true,
      source,
      history: sortedHistory
    }]);
    
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    setGameState(GameState.ROUND_END);
  };

  const nextRound = () => {
    setUserTeam(null);
    setFocusedTeamId(null);
    setMessages([]);
    setPossibleAnswersCount(null);
    setTimeLeft(30);
    setTeamFilter('');
    setGameState(GameState.SELECTION);
    
    // In P2P, host doesn't auto-pick here, waits for user interaction
    if (!isP2P && availableTeams.length > 0) {
       setOpponentTeam(availableTeams[Math.floor(Math.random() * availableTeams.length)]);
    }
  };

  const filteredTeams = useMemo(() => {
    if (!teamFilter) return availableTeams;
    return availableTeams.filter(t => t.name.toLowerCase().includes(teamFilter.toLowerCase()));
  }, [availableTeams, teamFilter]);

  const formatTime = (seconds: number) => `00:${seconds < 10 ? '0' : ''}${seconds}`;

  // Virtual Keyboard Handlers
  const handleVirtualChar = (char: string) => {
    setInputValue(prev => prev + char);
  };
  const handleVirtualDelete = () => {
    setInputValue(prev => prev.slice(0, -1));
  };
  const handleVirtualEnter = () => {
    handleUserSubmit();
  };

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-[#000022] font-mono text-white relative shadow-2xl overflow-hidden border-x-4 border-gray-800">
      
      {/* --- STICKY HUD --- */}
      <div className="sticky top-0 z-50 bg-[#151530] border-b-4 border-b-white/20 shadow-xl">
         <div className="grid grid-cols-[1fr_auto_1fr] items-center p-3 min-h-[100px] sm:min-h-[120px]">
             
             {/* PLAYER 1 */}
             <div className="flex flex-col items-start min-w-0 pr-2">
                 <div className="flex items-center gap-2 mb-2">
                     <span className="text-xs text-cyan-400 font-pixel tracking-widest bg-black/40 px-2 py-1 rounded">
                        {isP2P ? 'YOU' : 'P1'}
                     </span>
                     <div className="flex h-6 items-center bg-black/40 px-3 rounded border border-white/10">
                        <span className="text-lg font-pixel text-white">{scores.user}</span>
                     </div>
                 </div>
                 
                 {userTeam ? (
                    <div className="flex items-center gap-3 w-full">
                         <div className="h-12 w-12 sm:h-14 sm:w-14 border-4 border-white shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]" 
                              style={{ background: `linear-gradient(135deg, ${userTeam.colors[0]} 50%, ${userTeam.colors[1]} 50%)` }}></div>
                         <span className="font-pixel text-base sm:text-2xl text-white leading-tight drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] uppercase whitespace-nowrap truncate min-w-0">
                            {userTeam.name}
                         </span>
                    </div>
                 ) : (
                    <span className="font-pixel text-sm text-gray-500 animate-pulse">
                        {isP2P && !p2pManager.isHost ? 'WAITING FOR HOST...' : 'SELECT TEAM...'}
                    </span>
                 )}
             </div>

             {/* CENTER STATUS */}
             <div className="flex flex-col items-center justify-center px-2">
                 {gameState === GameState.SELECTION ? (
                    <div className="text-3xl font-pixel text-yellow-400 tabular-nums drop-shadow-md">
                        {formatTime(timeLeft)}
                    </div>
                 ) : (
                    <div className="text-2xl font-pixel text-gray-600 font-bold opacity-50">VS</div>
                 )}
             </div>

             {/* CPU / OPPONENT */}
             <div className="flex flex-col items-end min-w-0 pl-2">
                 <div className="flex items-center gap-2 mb-2">
                     <div className="flex h-6 items-center bg-black/40 px-3 rounded border border-white/10">
                        <span className="text-lg font-pixel text-white">{scores.opponent}</span>
                     </div>
                     <span className={`text-xs font-pixel tracking-widest bg-black/40 px-2 py-1 rounded ${isP2P ? 'text-green-400' : 'text-red-400'}`}>
                        {isP2P ? 'P2' : 'CPU'}
                     </span>
                 </div>

                 <div className="flex items-center gap-3 w-full justify-end">
                      {opponentTeam ? (
                         <>
                            <span className="font-pixel text-base sm:text-2xl text-white leading-tight drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] text-right uppercase whitespace-nowrap truncate min-w-0">
                                {gameState === GameState.SELECTION ? '???' : opponentTeam.name}
                            </span>
                            <div className={`h-12 w-12 sm:h-14 sm:w-14 border-4 border-white shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden ${gameState === GameState.SELECTION ? 'bg-black' : ''}`}
                                 style={gameState !== GameState.SELECTION ? { background: `linear-gradient(135deg, ${opponentTeam.colors[0]} 50%, ${opponentTeam.colors[1]} 50%)` } : {}}>
                                 {gameState === GameState.SELECTION && (
                                     <div className="flex gap-1 items-center">
                                         <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
                                         <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                         <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                     </div>
                                 )}
                            </div>
                         </>
                      ) : (
                         <span className="font-pixel text-sm text-gray-500">WAITING</span>
                      )}
                 </div>
             </div>
         </div>

         {/* Timer Progress Bar */}
         {gameState === GameState.SELECTION && (
             <div className="w-full h-2 bg-gray-900 border-t border-gray-700 relative">
                 <div 
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                 />
             </div>
         )}
      </div>

      {/* --- PHASE: SELECTION --- */}
      {gameState === GameState.SELECTION && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A1A]">
          {/* Controls Bar */}
          <div className="p-3 gap-2 flex flex-col sm:flex-row border-b border-gray-800 shrink-0">
             {(!isP2P || p2pManager.isHost) ? (
                 <>
                    <div className="flex gap-2 w-full">
                        <Button 
                            variant="secondary" 
                            className="px-3" 
                            onClick={() => {
                                if (isP2P) p2pManager.destroy();
                                navigate('/');
                            }}
                        >
                        «
                        </Button>
                        <input 
                            type="text"
                            placeholder="FIND CLUB..."
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            className="flex-1 bg-black border-2 border-gray-600 text-green-400 px-3 py-3 font-pixel text-[10px] uppercase focus:outline-none focus:border-green-400 placeholder-gray-700"
                        />
                        <Button variant="secondary" className="px-4 py-0 text-[10px]" onClick={handleRandomSelect}>
                        RND
                        </Button>
                    </div>
                    <p className="text-[9px] text-gray-500 text-center sm:text-left mt-1 sm:mt-0 font-pixel self-center">
                        TAP TO HIGHLIGHT • TAP AGAIN TO LOCK
                    </p>
                 </>
             ) : (
                 <div className="w-full text-center py-4 relative">
                     <button 
                        onClick={() => {
                            if (isP2P) p2pManager.destroy();
                            navigate('/');
                        }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white px-2"
                     >
                        «
                     </button>
                     <p className="text-yellow-400 font-pixel text-sm animate-pulse inline-block">WAITING FOR HOST TO SELECT...</p>
                 </div>
             )}
          </div>

          {/* Grid Area */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-black">
             {!isDbLoaded && (
                 <div className="flex h-full items-center justify-center">
                    <div className="text-center text-gray-500 font-pixel text-[10px] animate-pulse">LOADING TEAMS...</div>
                 </div>
             )}
             
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredTeams.map(team => {
                    const isLocked = userTeam?.id === team.id;
                    const isFocused = focusedTeamId === team.id;
                    const isDisabled = userTeam !== null && !isLocked;

                    let status: 'normal' | 'focused' | 'locked' | 'disabled' = 'normal';
                    
                    if (isLocked) status = 'locked';
                    else if (isDisabled) status = 'disabled';
                    else if (isFocused) status = 'focused';

                    return (
                        <TeamCard 
                            key={team.id}
                            team={team}
                            status={status}
                            onClick={() => handleTeamInteraction(team)}
                            compact={true}
                        />
                    );
                })}
            </div>
            <div className="h-20"></div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
             <div className="pointer-events-auto">
                <Button 
                    fullWidth 
                    onClick={() => focusedTeamId && confirmSelection(availableTeams.find(t => t.id === focusedTeamId)!)} 
                    disabled={!focusedTeamId || !!userTeam || (isP2P && !p2pManager.isHost)}
                    variant={userTeam ? "ghost" : "primary"}
                    className={userTeam ? "opacity-0" : "opacity-100 shadow-xl"}
                >
                    {focusedTeamId ? "CONFIRM SELECTION" : "SELECT A CLUB"}
                </Button>
             </div>
          </div>
        </div>
      )}

      {/* --- PHASE: REVEAL --- */}
      {gameState === GameState.REVEAL && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-black p-4 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
              <h2 className="text-2xl font-pixel text-yellow-400 blink">MATCHING...</h2>
          </div>
          <div className="w-full flex flex-row items-center justify-center gap-2 sm:gap-8 px-2">
             <div className="flex-1 flex flex-col items-center transform scale-110 transition-transform max-w-[45%]">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 border-4 border-white mx-auto bg-gray-800 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <div className="w-16 h-16 sm:w-20 sm:h-20" style={{ background: `linear-gradient(135deg, ${userTeam?.colors[0]} 50%, ${userTeam?.colors[1]} 50%)` }}></div>
                </div>
                <p className="font-pixel text-lg sm:text-xl text-white bg-black px-2 py-1 border border-gray-700 truncate w-full text-center">{userTeam?.name}</p>
             </div>
             
             <div className="text-4xl font-pixel text-white">&</div>

             <div className="flex-1 flex flex-col items-center transform scale-110 transition-transform max-w-[45%]">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 border-4 border-white mx-auto bg-gray-800 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <div className="w-16 h-16 sm:w-20 sm:h-20" style={{ background: `linear-gradient(135deg, ${opponentTeam?.colors[0]} 50%, ${opponentTeam?.colors[1]} 50%)` }}></div>
                </div>
                <p className="font-pixel text-lg sm:text-xl text-white bg-black px-2 py-1 border border-gray-700 truncate w-full text-center">{opponentTeam?.name}</p>
             </div>
          </div>
        </div>
      )}

      {/* --- PHASE: PLAYING --- */}
      {(gameState === GameState.PLAYING || gameState === GameState.ROUND_END) && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#111122]">
           {/* Header Info */}
           <div className="bg-black/50 border-y border-gray-700 p-2 flex justify-between items-center text-[10px] font-pixel shrink-0">
              <span className="text-gray-400">GUESS THE PLAYER</span>
              {possibleAnswersCount !== null && (
                  <span className="text-green-500">{possibleAnswersCount} MATCHES FOUND</span>
              )}
           </div>

           {/* Commentary Log */}
           <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto space-y-3 p-3 bg-black border-x-4 border-black font-pixel text-[11px] leading-relaxed shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"
           >
              {messages.length === 0 && (
                  <div className="text-green-800 flex flex-col items-center justify-center h-full opacity-50">
                      <p>WAITING FOR INPUT...</p>
                      {possibleAnswersCount === 0 && <p className="text-red-900 mt-2">DATABASE CHECKING...</p>}
                  </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`
                    ${msg.isSuccess ? 'text-[#44FF44]' : msg.isError ? 'text-[#FF4444]' : msg.isCpuWin ? 'text-gray-300' : 'text-[#FFFF44]'}
                `}>
                  <span className={msg.isError || msg.isSuccess || msg.isCpuWin ? "text-shadow-sm" : ""}>
                    {msg.highlight ? (
                        <>
                            {msg.prefix}
                            <span className={`font-bold tracking-widest ${
                                msg.isCpuWin ? 'text-[#FF6666]' : 
                                msg.isSuccess ? 'text-[#88FF88]' : 
                                'text-[#FFFF66]'
                            }`}>
                                {msg.highlight}
                            </span>
                            <span className={msg.isCpuWin ? 'text-[#FF6666]' : ''}>{msg.suffix}</span>
                        </>
                    ) : (
                        msg.text
                    )}
                  </span>
                  {msg.history && msg.history.length > 0 && (
                    <div className="pl-2 mt-1 border-l-2 border-gray-800 ml-1 py-1">
                      {msg.history.map((h, i) => (
                        <div key={i} className="text-[10px] text-gray-500 leading-tight mb-0.5">{h}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {gameState === GameState.PLAYING && !isP2P && !isUserValidating.current && possibleAnswersCount && possibleAnswersCount > 0 && (
                  <div className="text-gray-600 text-[10px] animate-pulse mt-4">
                      {'>'} CPU IS THINKING...
                  </div>
              )}
              {gameState === GameState.PLAYING && isP2P && (
                  <div className="text-gray-600 text-[10px] animate-pulse mt-4">
                      {'>'} VS {p2pManager.opponentName}...
                  </div>
              )}
           </div>

           {/* Input Area */}
           {gameState === GameState.PLAYING ? (
             <div className="shrink-0 flex flex-col">
               {/* Controls Row */}
               <div className="flex justify-between items-center px-2 py-1 bg-[#0A0A1A] border-y border-gray-700 text-[10px] font-pixel">
                  <button 
                    onClick={() => {
                        if (isP2P) p2pManager.destroy();
                        navigate('/');
                    }}
                    className="text-gray-500 hover:text-white px-2 py-1"
                  >
                    « MENU
                  </button>
                  <button 
                    onClick={handleSurrender}
                    className="text-red-500 hover:text-red-400 px-2 py-1 flex items-center gap-2"
                    disabled={isUserValidating.current}
                  >
                    GIVE UP
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
                        <path d="M4 6h2v2h-2z M10 6h2v2h-2z M5 11h6v1H5z M4 12h1v1h-1z M11 12h1v1h-1z" />
                    </svg>
                  </button>
               </div>
               
               {/* Read-only Display Box */}
               <div className="flex gap-2 items-center bg-gray-900 p-2 border-x-2 border-gray-600">
                 <span className="font-pixel text-green-500 text-xs blink">{'>'}</span>
                 <div className="flex-1 bg-transparent text-white font-pixel text-lg h-8 flex items-center overflow-hidden whitespace-nowrap">
                   {inputValue}
                   <span className="animate-pulse ml-0.5 opacity-50">_</span>
                 </div>
               </div>

               {/* Virtual Keyboard */}
               <VirtualKeyboard 
                  onChar={handleVirtualChar}
                  onDelete={handleVirtualDelete}
                  onEnter={handleVirtualEnter}
                  disabled={possibleAnswersCount === 0 || isUserValidating.current}
               />
             </div>
           ) : (
             <div className="mt-auto space-y-3 shrink-0 pb-safe p-2">
               <div className={`p-3 text-center border-4 ${
                   messages.find(m => m.isSuccess) 
                    ? 'bg-green-900 border-green-500 text-green-100' 
                    : messages.find(m => m.isCpuWin)
                        ? 'bg-red-900 border-red-500 text-red-100'
                        : 'bg-gray-800 border-gray-500 text-gray-300'
               }`}>
                 <h3 className="font-pixel text-sm uppercase tracking-widest">
                   {messages.find(m => m.isSuccess) 
                    ? (isP2P ? 'YOU WIN ROUND' : 'PLAYER 1 WINS ROUND')
                    : messages.find(m => m.isCpuWin) 
                        ? (isP2P ? `${p2pManager.opponentName} WINS` : 'CPU WINS ROUND')
                        : 'DRAW: NO POINTS'}
                 </h3>
               </div>
               <div className="grid grid-cols-2 gap-3">
                    <Button fullWidth onClick={nextRound} className="h-12 text-xs">NEXT ROUND</Button>
                    <Button fullWidth variant="secondary" onClick={() => {
                        if (isP2P) p2pManager.destroy();
                        navigate('/');
                    }} className="h-12 text-xs">QUIT</Button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GamePage;