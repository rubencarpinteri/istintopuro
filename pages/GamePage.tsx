import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { TeamCard } from '../components/TeamCard';
import { TEAMS } from '../constants';
import { GameState, Team } from '../types';
import { getAIAnswers } from '../services/geminiService';
import { verifyAnswer, getMatchingPlayers } from '../services/verificationService';

// Color generator for teams not in constants (fallback)
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

interface GameMessage {
  text?: string;        // For simple messages
  prefix?: string;      // Text before the name
  highlight?: string;   // The player name (to be colored)
  suffix?: string;      // Text after the name
  isError?: boolean;
  isSuccess?: boolean;
  source?: string;
  history?: string[];
}

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

  // Update message state to include structured text for highlighting
  const [messages, setMessages] = useState<GameMessage[]>([]);
  
  const [scores, setScores] = useState({ user: 0, opponent: 0 });
  const [possibleAnswersCount, setPossibleAnswersCount] = useState<number | null>(null);
  
  // Refs for AI behavior
  const aiPotentialAnswers = useRef<string[]>([]);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
            // Check if we have a preset configuration for this team in updated constants
            const preset = TEAMS.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (preset) return preset;

            // Otherwise generate a consistent color
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                name: name,
                colors: [generateColor(name), '#333333'] 
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

  // Game Start Effect & INPUT CLEARING LOGIC
  useEffect(() => {
    // Input box should always be empty when it's time to guess
    if (gameState === GameState.PLAYING) {
        setInputValue(''); // Clear input whenever we enter PLAYING state
    }

    if (gameState === GameState.PLAYING && userTeam && opponentTeam) {
      setTimeout(() => inputRef.current?.focus(), 100);
      checkPossibilitiesAndStart(userTeam.name, opponentTeam.name);
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

  const handleTeamClick = (team: Team) => {
    if (userTeam?.id === team.id) {
        // Double click/press confirms
        startReveal();
    } else {
        setUserTeam(team);
    }
  };

  const handleAutoSelect = () => {
    if (!userTeam && availableTeams.length > 0) {
      const random = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      setUserTeam(random);
    }
    startReveal();
  };

  const startReveal = () => {
    if (!userTeam) return;
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
            text: `*** MATCH ABANDONED ***\nNo players found for ${team1} + ${team2}.`, 
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
            
            // Check if the AI's answer is in the list
            // We subtract 1 because the current answer is revealed
            const remaining = allMatches.length - 1; 
            
            if (remaining > 0) {
                extraText = ` (...and ${remaining} more!)`;
            } else {
                extraText = ` ... and that's the only one!`;
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
      prefix: "> CPU scores with ",
      highlight: answer.toUpperCase(),
      suffix: extraText,
      isError: true, // Will use specific red in rendering
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
    setMessages(prev => [...prev, { text: `> Analyzing: ${rawInput}...` }]);

    // 1. Optimistic check: Did AI already find this player?
    const isKnownValid = aiPotentialAnswers.current.some(a => 
        a.toLowerCase().includes(rawInput.toLowerCase()) || 
        rawInput.toLowerCase().includes(a.toLowerCase())
    );
    
    // 2. Full Verification
    const result = await verifyAnswer(userTeam.name, opponentTeam.name, rawInput);

    if (result.isValid) {
      const displayName = result.correctedName || rawInput;
      handleSuccess(displayName, result.source || 'DB', result.history);
    } else if (isKnownValid) {
       const matchName = aiPotentialAnswers.current.find(a => a.toLowerCase().includes(rawInput.toLowerCase())) || rawInput;
       handleSuccess(matchName, 'AI', []);
    } else {
      setMessages(prev => [...prev, { text: `> REJECTED: ${rawInput} is not valid.`, isError: true }]);
    }
  };

  const handleSuccess = async (answer: string, source: string, history?: string[]) => {
    let extraText = '';
    if (userTeam && opponentTeam) {
        const allMatches = await getMatchingPlayers(userTeam.name, opponentTeam.name);
        const remaining = allMatches.length - 1; 
        if (remaining > 0) {
            extraText = ` (...and ${remaining} more!)`;
        } else {
            extraText = ` ... and that's the only one!`;
        }
    }

    setScores(prev => ({ ...prev, user: prev.user + 1 }));
    setMessages(prev => [...prev, { 
      prefix: "> GOAL! ",
      highlight: answer.toUpperCase(),
      suffix: ` is correct!${extraText}`,
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
    <div className="min-h-screen flex flex-col max-w-lg mx-auto p-4 relative z-10 font-mono text-white">
      
      {/* 16-BIT SCOREBOARD */}
      <div className="flex items-center justify-between mb-4 bg-black border-4 border-gray-500 p-2 shadow-lg">
        <div className="text-center w-1/3">
          <p className="font-pixel text-[10px] text-blue-400">PLAYER 1</p>
          <p className="text-4xl font-pixel text-white">{scores.user}</p>
        </div>
        <div className="text-center w-1/3 flex flex-col items-center justify-center">
            <span className="font-pixel text-[10px] text-red-500 blink uppercase tracking-tighter">
                {gameState === GameState.SELECTION ? 'CHOOSE' : 'MATCH'}
            </span>
            <div className="w-full h-1 bg-gray-700 mt-1"></div>
        </div>
        <div className="text-center w-1/3">
          <p className="font-pixel text-[10px] text-red-400">CPU</p>
          <p className="text-4xl font-pixel text-white">{scores.opponent}</p>
        </div>
      </div>

      {/* PHASE: SELECTION */}
      {gameState === GameState.SELECTION && (
        <div className="flex-1 flex flex-col h-full overflow-hidden retro-box p-4 bg-gray-900">
          <div className="text-center mb-4 shrink-0">
            <h2 className="text-sm font-pixel text-yellow-400 mb-2 tracking-widest">DOUBLE-TAP CLUB</h2>
            <div className="font-pixel text-red-500 text-[10px] mb-3">
              TIME REMAINING: {timeLeft}
            </div>
            
            <input 
                type="text"
                placeholder="FILTER CLUBS..."
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full bg-black border-2 border-green-800 text-green-500 px-3 py-2 font-pixel text-[10px] uppercase focus:outline-none focus:border-green-400 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 mb-4 pr-1 scrollbar-thin">
             {!isDbLoaded && (
                 <div className="text-center py-8 text-gray-500 font-pixel text-[10px]">ACCESSING DATABASE...</div>
             )}
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {filteredTeams.map(team => (
                <TeamCard 
                    key={team.id}
                    team={team}
                    selected={userTeam?.id === team.id}
                    onClick={() => handleTeamClick(team)}
                    compact={true}
                />
                ))}
            </div>
            {filteredTeams.length === 0 && isDbLoaded && (
                <div className="text-center py-8 text-gray-500 font-pixel text-[10px]">NO MATCHES FOUND</div>
            )}
          </div>

          <div className="shrink-0 pt-2 border-t-2 border-gray-800">
            <Button fullWidth onClick={startReveal} disabled={!userTeam}>
                CONFIRM SELECTION
            </Button>
          </div>
        </div>
      )}

      {/* PHASE: REVEAL */}
      {gameState === GameState.REVEAL && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 retro-box bg-black p-4">
          <h2 className="text-2xl font-pixel text-yellow-400 blink">VERSUS</h2>
          <div className="w-full flex items-center justify-between px-2">
             <div className="text-center w-5/12">
                <div className="w-20 h-20 mb-4 border-4 border-blue-500 mx-auto bg-gray-800 flex items-center justify-center">
                    <div className="w-16 h-16" style={{ background: userTeam?.colors[0] }}></div>
                </div>
                <p className="font-pixel text-xs" style={{ color: userTeam?.colors[0] || 'white' }}>
                    {userTeam?.name}
                </p>
             </div>
             <div className="text-2xl font-pixel text-white">&</div>
             <div className="text-center w-5/12">
                <div className="w-20 h-20 mb-4 border-4 border-red-500 mx-auto bg-gray-800 flex items-center justify-center">
                    <div className="w-16 h-16" style={{ background: opponentTeam?.colors[0] }}></div>
                </div>
                <p className="font-pixel text-xs" style={{ color: opponentTeam?.colors[0] || 'white' }}>
                    {opponentTeam?.name}
                </p>
             </div>
          </div>
        </div>
      )}

      {/* PHASE: PLAYING */}
      {(gameState === GameState.PLAYING || gameState === GameState.ROUND_END) && (
        <div className="flex-1 flex flex-col min-h-0 retro-box bg-gray-900 p-2">
           {/* Header Info - Using Actual Team Colors */}
           <div className="bg-black border-b-2 border-gray-700 p-2 mb-2 flex justify-between items-center text-[10px] font-pixel">
              <span style={{ color: userTeam?.colors[0] }}>{userTeam?.name}</span>
              <span className="text-gray-500">VS</span>
              <span style={{ color: opponentTeam?.colors[0] }}>{opponentTeam?.name}</span>
           </div>

           {/* Commentary Log (Terminal Style) */}
           <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto mb-2 space-y-2 p-2 bg-black border-2 border-gray-700 font-mono text-sm leading-tight shadow-inner"
             style={{ fontFamily: "'VT323', monospace", fontSize: "1.2rem" }}
           >
              {messages.length === 0 && (
                  <div className="text-green-700">
                      {'>'} WAITING FOR INPUT...<br/>
                      {'>'} {possibleAnswersCount === 0 ? "DATABASE CHECKING..." : "ENTER PLAYER SURNAME"}
                  </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`
                    ${msg.isSuccess ? 'text-[#00FF00]' : msg.isError ? 'text-[#FF5555]' : 'text-[#FFFF00]'}
                `}>
                  <span className={msg.isError || msg.isSuccess ? "font-bold text-shadow-sm" : ""}>
                    {msg.highlight ? (
                        <>
                            {msg.prefix}
                            <span className="text-[#99FF99] tracking-wider">{msg.highlight}</span>
                            {msg.suffix}
                        </>
                    ) : (
                        msg.text
                    )}
                  </span>
                  {msg.history && msg.history.length > 0 && (
                    <div className="pl-4 mt-1 text-[#88CCFF] font-pixel text-[10px] leading-relaxed tracking-wide">
                      {msg.history.map((h, i) => (
                        <div key={i}>- {h}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
           </div>

           {/* Input Area */}
           {gameState === GameState.PLAYING ? (
             <form onSubmit={handleUserSubmit} className="mt-auto shrink-0">
               <div className="flex gap-2">
                 <span className="self-center font-pixel text-green-500 text-xs">{'>'}</span>
                 <input
                   ref={inputRef}
                   type="text"
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   disabled={possibleAnswersCount === 0}
                   className="flex-1 bg-black text-green-400 font-pixel text-xs p-3 border-2 border-green-800 focus:outline-none focus:border-green-500 uppercase"
                   placeholder={possibleAnswersCount === 0 ? "NO MATCHES" : "TYPE NAME..."}
                   autoComplete="off"
                   autoFocus
                 />
                 <Button type="submit" disabled={possibleAnswersCount === 0 || !inputValue.trim()} className="px-3">
                    ENTER
                 </Button>
               </div>
             </form>
           ) : (
             <div className="mt-auto space-y-2 shrink-0">
               <div className={`p-2 text-center border-2 ${
                   messages.find(m => m.isSuccess) 
                    ? 'bg-green-900 border-green-500 text-green-100' 
                    : 'bg-red-900 border-red-500 text-red-100'
               }`}>
                 <h3 className="font-pixel text-xs">
                   {messages.find(m => m.isSuccess) ? 'PLAYER 1 WINS ROUND' : 'CPU WINS ROUND'}
                 </h3>
               </div>
               <div className="grid grid-cols-2 gap-2">
                    <Button fullWidth onClick={nextRound}>NEXT ROUND</Button>
                    <Button fullWidth variant="secondary" onClick={() => navigate('/')}>QUIT</Button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GamePage;