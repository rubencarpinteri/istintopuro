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
import { storageService } from '../services/storageService';

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
  const bestOfParam = searchParams.get('bestOf');
  const maxRounds = bestOfParam ? parseInt(bestOfParam) : 3;
  const targetWins = Math.ceil(maxRounds / 2);

  const [gameState, setGameState] = useState<GameState>(GameState.SELECTION);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  
  // Selection State
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null); 
  const [userTeam, setUserTeam] = useState<Team | null>(null); 
  
  // Opponent State
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null); 
  const [opponentSecretTeam, setOpponentSecretTeam] = useState<Team | null>(null); 
  const [isOpponentReady, setIsOpponentReady] = useState(false);

  const [timeLeft, setTimeLeft] = useState(30); 
  const [roundTimeLeft, setRoundTimeLeft] = useState(60); 
  const [inputValue, setInputValue] = useState('');
  
  // Data State
  const [availableTeams, setAvailableTeams] = useState<Team[]>(TEAMS);
  const [teamFilter, setTeamFilter] = useState('');
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Gameplay State
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [scores, setScores] = useState({ user: 0, opponent: 0 }); // Rounds won
  const [matchWinner, setMatchWinner] = useState<'USER' | 'OPPONENT' | 'DISCONNECT' | null>(null);
  
  const [possibleAnswersCount, setPossibleAnswersCount] = useState<number | null>(null);
  
  // Refs
  const aiPotentialAnswers = useRef<string[]>([]);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Refs for race condition handling
  const isUserValidating = useRef(false);
  const aiPendingWin = useRef<string | null>(null);

  // Match End Logic
  useEffect(() => {
     if (scores.user >= targetWins) {
         setMatchWinner('USER');
         setGameState(GameState.MATCH_END);
         storageService.saveMatch('WIN', isP2P ? p2pManager.opponentName : 'CPU', `Match (Best of ${maxRounds})`);
     } else if (scores.opponent >= targetWins) {
         setMatchWinner('OPPONENT');
         setGameState(GameState.MATCH_END);
         storageService.saveMatch('LOSS', isP2P ? p2pManager.opponentName : 'CPU', `Match (Best of ${maxRounds})`);
     }
  }, [scores, targetWins, isP2P, maxRounds]);

  // P2P Listeners
  useEffect(() => {
    if (!isP2P) return;

    // Handle Opponent Disconnect specifically
    p2pManager.onDisconnect(() => {
        setMatchWinner('DISCONNECT');
        setGameState(GameState.MATCH_END);
    });

    const removeListener = p2pManager.onMessage((msg) => {
        if (msg.type === 'OPPONENT_DISCONNECT') {
             setMatchWinner('DISCONNECT');
             setGameState(GameState.MATCH_END);
        }
        else if (msg.type === 'TEAM_SELECT') {
            const { teamId } = msg.payload;
            const selected = availableTeams.find(t => t.id === teamId);
            if (selected) {
                setOpponentSecretTeam(selected);
                setIsOpponentReady(true);
            }
        } 
        else if (msg.type === 'SCORE_UPDATE') {
            const { answer, history } = msg.payload;
            setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
            setMessages(prev => [...prev, { 
                prefix: `> ${p2pManager.opponentName} found: `,
                highlight: answer.toUpperCase(),
                isCpuWin: true, 
                history: history
            }]);
            setGameState(GameState.ROUND_END);
        }
        else if (msg.type === 'ROUND_TIMEOUT') {
             handleDraw("TIME UP!");
        }
    });

    return () => removeListener();
  }, [isP2P, availableTeams]);

  // Sync Effect: Check if both players are ready to reveal
  useEffect(() => {
    if (isP2P && gameState === GameState.SELECTION) {
        if (userTeam && isOpponentReady && opponentSecretTeam) {
            setOpponentTeam(opponentSecretTeam); // Now we can show it
            startReveal();
        }
    }
  }, [isP2P, gameState, userTeam, isOpponentReady, opponentSecretTeam]);


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

  // Selection Timer (30s) - Only Host or Single Player
  useEffect(() => {
    if (gameState === GameState.SELECTION && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameState === GameState.SELECTION && timeLeft === 0) {
      if (!userTeam) {
          handleAutoSelect();
      }
    }
  }, [gameState, timeLeft, userTeam]);

  // Round Timer
  useEffect(() => {
      if (gameState !== GameState.PLAYING) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          return;
      }

      setRoundTimeLeft(60);

      // Only Host manages authoritative timer in P2P, or Single Player
      if (!isP2P || p2pManager.isHost) {
          roundTimerRef.current = setInterval(() => {
              setRoundTimeLeft(prev => {
                  if (prev <= 1) {
                      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
                      if (isP2P) {
                          p2pManager.send('ROUND_TIMEOUT', {});
                      }
                      handleDraw("TIME UP!");
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      } else {
           roundTimerRef.current = setInterval(() => {
              setRoundTimeLeft(prev => Math.max(0, prev - 1));
           }, 1000);
      }

      return () => {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      };
  }, [gameState, isP2P]);


  // AI Selection & Setup Effect (Only for Single Player)
  useEffect(() => {
    if (!isP2P && gameState === GameState.SELECTION && availableTeams.length > 0 && !opponentSecretTeam) {
          const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
          setOpponentSecretTeam(randomTeam);
          setIsOpponentReady(true);
    }
  }, [gameState, availableTeams, isP2P, opponentSecretTeam]);

  // Game Start Effect
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        setInputValue(''); 
        isUserValidating.current = false;
        aiPendingWin.current = null;
    }

    if (gameState === GameState.PLAYING && userTeam && opponentTeam) {
      if (isP2P) {
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

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Keyboard Listener
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
    if (userTeam) return; // Locked

    if (focusedTeamId === team.id) {
        confirmSelection(team);
    } else {
        setFocusedTeamId(team.id);
    }
  };

  const confirmSelection = (team: Team) => {
    setUserTeam(team);
    setFocusedTeamId(team.id); 
    
    if (isP2P) {
        p2pManager.send('TEAM_SELECT', { teamId: team.id });
    } else {
        // AI Mode: reveal opponent selection just before starting reveal phase
        if (opponentSecretTeam) {
            setOpponentTeam(opponentSecretTeam);
        }
        setTimeout(() => startReveal(), 600);
    }
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

  const handleDraw = (reason: string = "DRAW") => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
      setMessages(prev => [...prev, { text: `> ${reason}`, isError: true }]);
      setGameState(GameState.ROUND_END);
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
    
    setMessages(prev => [...prev, { text: `> Analyzing: ${rawInput}...` }]);

    const result = await verifyAnswer(userTeam.name, opponentTeam.name, rawInput);
    isUserValidating.current = false;

    if (result.isValid) {
      const displayName = result.correctedName || rawInput;
      handleSuccess(displayName, result.source || 'DB', result.history);
      
      if (isP2P) {
          p2pManager.send('SCORE_UPDATE', {
              answer: displayName,
              history: result.history
          });
      }

    } else {
      setMessages(prev => [...prev, { text: `> REJECTED: ${rawInput} is not valid.`, isError: true }]);
      if (!isP2P && aiPendingWin.current) {
          handleAIWin(aiPendingWin.current);
          aiPendingWin.current = null;
      }
    }
  };

  const handleSuccess = async (answer: string, source: string, history?: string[]) => {
    let sortedHistory: string[] = [];
    if (userTeam && opponentTeam && history) {
         sortedHistory = sortHistory(history);
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
    setOpponentSecretTeam(null);
    setIsOpponentReady(false);
    setFocusedTeamId(null);
    setMessages([]);
    setPossibleAnswersCount(null);
    setTimeLeft(30);
    setRoundTimeLeft(60);
    setTeamFilter('');
    setGameState(GameState.SELECTION);
    setOpponentTeam(null);
  };

  const handleQuitRequest = () => {
      setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
      if (isP2P) p2pManager.destroy();
      navigate('/');
  };

  const filteredTeams = useMemo(() => {
    if (!teamFilter) return availableTeams;
    return availableTeams.filter(t => t.name.toLowerCase().includes(teamFilter.toLowerCase()));
  }, [availableTeams, teamFilter]);

  const formatTime = (seconds: number) => `00:${seconds < 10 ? '0' : ''}${seconds}`;

  const handleVirtualChar = (char: string) => setInputValue(prev => prev + char);
  const handleVirtualDelete = () => setInputValue(prev => prev.slice(0, -1));
  const handleVirtualEnter = () => handleUserSubmit();

  // --- MATCH END RENDER ---
  if (gameState === GameState.MATCH_END) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] text-white p-4 font-pixel relative overflow-hidden">
               <div className="absolute inset-0 bg-repeat opacity-10 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>
               
               <div className="z-10 text-center space-y-8 max-w-md w-full border-4 border-white p-6 bg-black shadow-[10px_10px_0px_#000]">
                   {matchWinner === 'DISCONNECT' ? (
                       <>
                           <h1 className="text-4xl text-yellow-400 mb-4">OPPONENT LEFT</h1>
                           <div className="text-6xl mb-4">🏳️</div>
                           <p className="text-green-400 text-xl">YOU WIN BY FORFEIT!</p>
                       </>
                   ) : (
                       <>
                           <h1 className="text-4xl text-yellow-400 mb-4">MATCH OVER</h1>
                           <div className="flex justify-center items-end gap-4 mb-6">
                               <div className="text-center">
                                   <div className="text-4xl font-bold">{scores.user}</div>
                                   <div className="text-xs text-gray-500">YOU</div>
                               </div>
                               <div className="text-2xl text-gray-600 mb-2">-</div>
                               <div className="text-center">
                                   <div className="text-4xl font-bold">{scores.opponent}</div>
                                   <div className="text-xs text-gray-500">{isP2P ? 'P2' : 'CPU'}</div>
                               </div>
                           </div>
                           
                           {matchWinner === 'USER' ? (
                               <div className="animate-bounce">
                                   <p className="text-green-400 text-2xl mb-2">VICTORY!</p>
                                   <p className="text-xs text-gray-400">CHAMPION OF SERIE A</p>
                               </div>
                           ) : (
                               <div>
                                   <p className="text-red-500 text-2xl mb-2">DEFEAT</p>
                                   <p className="text-xs text-gray-400">BETTER LUCK NEXT SEASON</p>
                               </div>
                           )}
                       </>
                   )}

                   <div className="pt-8">
                       <Button fullWidth onClick={() => {
                           if(isP2P) p2pManager.destroy();
                           navigate('/');
                       }}>
                           RETURN TO MENU
                       </Button>
                   </div>
               </div>
          </div>
      );
  }

  // --- MAIN RENDER ---
  // Using fixed height and inset-0 to ensure it fits mobile screens perfectly without scrolling the body
  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-[#0F1419] font-mono text-white relative shadow-2xl overflow-hidden sm:max-w-2xl sm:mx-auto sm:border-x-4 sm:border-gray-800">
      
      {/* Quit Confirmation Modal */}
      {showQuitConfirm && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border-4 border-white p-6 max-w-xs w-full text-center shadow-[10px_10px_0px_#000]">
                <h3 className="font-pixel text-yellow-400 mb-4 text-sm">QUIT MATCH?</h3>
                <p className="text-gray-400 text-xs mb-6 font-pixel">PROGRESS WILL BE LOST.</p>
                <div className="flex gap-2">
                    <Button fullWidth onClick={confirmQuit} variant="danger" className="text-xs">YES, QUIT</Button>
                    <Button fullWidth onClick={() => setShowQuitConfirm(false)} variant="secondary" className="text-xs">CANCEL</Button>
                </div>
            </div>
        </div>
      )}

      {/* --- STICKY HUD --- */}
      <div className="sticky top-0 z-50 bg-[#151530] border-b-4 border-b-white/20 shadow-xl shrink-0">
         {/* Rounds Indicator */}
         <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
             <div className="bg-black/80 px-3 py-1 rounded-full border border-white/10 text-[9px] font-pixel text-yellow-400 shadow-md">
                 FIRST TO {targetWins} WINS
             </div>
         </div>

         <div className="grid grid-cols-[1fr_auto_1fr] items-center p-3 pt-5 min-h-[100px] sm:min-h-[120px]">
             
             {/* PLAYER 1 */}
             <div className="flex flex-col items-start min-w-0 pr-2">
                 <div className="flex items-center gap-2 mb-2">
                     <span className="text-xs text-cyan-400 font-pixel tracking-widest bg-black/40 px-2 py-1 rounded">
                        {isP2P ? 'YOU' : 'P1'}
                     </span>
                     {/* Score Dots */}
                     <div className="flex gap-1">
                         {Array.from({length: targetWins}).map((_, i) => (
                             <div key={i} className={`w-2 h-2 rounded-full ${i < scores.user ? 'bg-green-500 box-shadow-glow' : 'bg-gray-700'}`} />
                         ))}
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
                        SELECT TEAM...
                    </span>
                 )}
             </div>

             {/* CENTER STATUS */}
             <div className="flex flex-col items-center justify-center px-2 pt-2">
                 {gameState === GameState.SELECTION ? (
                    <div className="text-3xl font-pixel text-yellow-400 tabular-nums drop-shadow-md">
                        {formatTime(timeLeft)}
                    </div>
                 ) : gameState === GameState.PLAYING ? (
                    <div className="text-3xl font-pixel text-red-500 tabular-nums drop-shadow-md animate-pulse">
                        {formatTime(roundTimeLeft)}
                    </div>
                 ) : (
                    <div className="text-2xl font-pixel text-gray-600 font-bold opacity-50">VS</div>
                 )}
             </div>

             {/* CPU / OPPONENT */}
             <div className="flex flex-col items-end min-w-0 pl-2">
                 <div className="flex items-center gap-2 mb-2">
                     <div className="flex gap-1">
                         {Array.from({length: targetWins}).map((_, i) => (
                             <div key={i} className={`w-2 h-2 rounded-full ${i < scores.opponent ? 'bg-red-500 box-shadow-glow' : 'bg-gray-700'}`} />
                         ))}
                     </div>
                     <span className={`text-xs font-pixel tracking-widest bg-black/40 px-2 py-1 rounded ${isP2P ? 'text-green-400' : 'text-red-400'}`}>
                        {isP2P ? 'P2' : 'CPU'}
                     </span>
                 </div>

                 <div className="flex items-center gap-3 w-full justify-end">
                      {(isP2P || !opponentTeam) && gameState === GameState.SELECTION ? (
                          isOpponentReady ? (
                              <div className="flex flex-col items-end">
                                  <span className={`text-white text-[10px] font-pixel px-2 py-1 mb-1 animate-pulse border shadow-[0_0_10px_rgba(74,222,128,0.5)] ${isP2P ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'}`}>
                                      {isP2P ? 'READY' : 'CPU READY'}
                                  </span>
                                  <div className="flex items-center gap-2 opacity-50 grayscale">
                                      <span className="font-pixel text-sm text-gray-400">HIDDEN</span>
                                      <div className="h-10 w-10 border-2 border-gray-600 bg-gray-800 flex items-center justify-center text-gray-500">?</div>
                                  </div>
                              </div>
                          ) : (
                              <span className="font-pixel text-[10px] text-gray-500 animate-pulse">
                                  {isP2P ? 'SELECTING...' : 'CPU THINKING...'}
                              </span>
                          )
                      ) : opponentTeam ? (
                         <>
                            <span className="font-pixel text-base sm:text-2xl text-white leading-tight drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] text-right uppercase whitespace-nowrap truncate min-w-0">
                                {opponentTeam.name}
                            </span>
                            <div className="h-12 w-12 sm:h-14 sm:w-14 border-4 border-white shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden"
                                 style={{ background: `linear-gradient(135deg, ${opponentTeam.colors[0]} 50%, ${opponentTeam.colors[1]} 50%)` }}>
                            </div>
                         </>
                      ) : (
                         <span className="font-pixel text-sm text-gray-500">WAITING</span>
                      )}
                 </div>
             </div>
         </div>

         {/* Timer Progress Bar */}
         {(gameState === GameState.SELECTION || gameState === GameState.PLAYING) && (
             <div className="w-full h-2 bg-gray-900 border-t border-gray-700 relative">
                 <div 
                    className="h-full transition-all duration-1000 ease-linear bg-gradient-to-r from-green-500 via-yellow-400 to-red-500"
                    style={{ 
                        width: `${gameState === GameState.PLAYING ? (roundTimeLeft/60)*100 : (timeLeft/30)*100}%` 
                    }}
                 />
             </div>
         )}
      </div>

      {/* --- PHASE: SELECTION --- */}
      {gameState === GameState.SELECTION && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A1A] relative pb-safe">
          
          {/* Controls Bar */}
          <div className="p-3 gap-2 flex flex-col sm:flex-row border-b border-gray-800 shrink-0">
             <div className="flex gap-2 w-full">
                <Button 
                    variant="secondary" 
                    className="px-3" 
                    onClick={handleQuitRequest}
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
          </div>

          {/* Grid Area */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-black pb-24">
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
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
             <div className="pointer-events-auto">
                <Button 
                    fullWidth 
                    onClick={() => focusedTeamId && confirmSelection(availableTeams.find(t => t.id === focusedTeamId)!)} 
                    disabled={!focusedTeamId || !!userTeam}
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
                <p className="font-pixel text-lg sm:text-xl text-white bg-black px-2 py-1 truncate w-full text-center">{userTeam?.name}</p>
             </div>
             
             <div className="text-4xl font-pixel text-white">&</div>

             <div className="flex-1 flex flex-col items-center transform scale-110 transition-transform max-w-[45%]">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 border-4 border-white mx-auto bg-gray-800 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <div className="w-16 h-16 sm:w-20 sm:h-20" style={{ background: `linear-gradient(135deg, ${opponentTeam?.colors[0]} 50%, ${opponentTeam?.colors[1]} 50%)` }}></div>
                </div>
                <p className="font-pixel text-lg sm:text-xl text-white bg-black px-2 py-1 truncate w-full text-center">{opponentTeam?.name}</p>
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
             <div className="shrink-0 flex flex-col z-20 bg-[#0F1419] pb-safe">
               {/* Controls Row */}
               <div className="flex justify-between items-center px-2 py-1 bg-[#0A0A1A] border-y border-gray-700 text-[10px] font-pixel">
                  <button 
                    onClick={handleQuitRequest}
                    className="text-gray-500 hover:text-white px-2 py-2"
                  >
                    « MENU
                  </button>
                  <button 
                    onClick={handleSurrender}
                    className="text-red-500 hover:text-red-400 px-2 py-2 flex items-center gap-2"
                    disabled={isUserValidating.current}
                  >
                    GIVE UP
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
                        <path d="M4 6h2v2h-2z M10 6h2v2h-2z M5 11h6v1H5z M4 12h1v1h-1z M11 12h1v1h-1z" />
                    </svg>
                  </button>
               </div>
               
               {/* Read-only Display Box + Send Button */}
               <div className="flex items-center bg-gray-900 p-2 border-x-2 border-gray-600">
                 <span className="font-pixel text-green-500 text-xs blink mr-2">{'>'}</span>
                 <div className="flex-1 bg-transparent text-white font-pixel text-lg h-8 flex items-center overflow-hidden whitespace-nowrap">
                   {inputValue}
                   <span className="animate-pulse ml-0.5 opacity-50">_</span>
                 </div>
                 <button 
                    onClick={(e) => handleUserSubmit(e)}
                    disabled={!inputValue.trim() || isUserValidating.current}
                    className={`
                        ml-2 px-4 py-2 border-2 font-pixel text-[10px] uppercase tracking-wider
                        transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1
                        ${!inputValue.trim() || isUserValidating.current 
                            ? 'bg-gray-700 border-gray-500 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 border-green-400 text-white hover:bg-green-500 cursor-pointer'}
                    `}
                 >
                    SEND
                 </button>
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
             <div className="mt-auto space-y-3 shrink-0 p-4 pb-safe bg-[#0F1419] z-20 border-t-4 border-gray-800">
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
                    <Button fullWidth onClick={nextRound} className="h-14 text-xs">NEXT ROUND</Button>
                    <Button fullWidth variant="secondary" onClick={handleQuitRequest} className="h-14 text-xs">QUIT</Button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GamePage;