import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { TeamCard } from '../components/TeamCard';
import { TEAMS } from '../constants';
import { GameState, Team } from '../types';
import { getAIAnswers } from '../services/geminiService';
import { verifyAnswer } from '../services/verificationService';

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>(GameState.SELECTION);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [inputValue, setInputValue] = useState('');
  
  // Update message state to include optional history array
  const [messages, setMessages] = useState<{
    text: string, 
    isError?: boolean, 
    isSuccess?: boolean, 
    source?: string,
    history?: string[] 
  }[]>([]);
  
  const [scores, setScores] = useState({ user: 0, opponent: 0 });
  
  // Refs for AI behavior
  const aiPotentialAnswers = useRef<string[]>([]);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Preload DB
  useEffect(() => {
    // Start loading the huge DB chunk in background so it's ready when user submits
    import('../data/localDb').then(() => {
        console.log("Local DB preloaded");
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
    if (gameState === GameState.SELECTION) {
      const randomTeam = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      setOpponentTeam(randomTeam);
    }
  }, [gameState]);

  // Game Start Effect
  useEffect(() => {
    if (gameState === GameState.PLAYING && userTeam && opponentTeam) {
      setTimeout(() => inputRef.current?.focus(), 100);
      startAITurn(userTeam.name, opponentTeam.name);
    }
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, [gameState]);

  const handleAutoSelect = () => {
    if (!userTeam) {
      const random = TEAMS[Math.floor(Math.random() * TEAMS.length)];
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

  const startAITurn = async (team1: string, team2: string) => {
    // This now queries the Local DB first
    const answers = await getAIAnswers(team1, team2);
    aiPotentialAnswers.current = answers;

    if (answers.length > 0) {
      // AI "thinks" between 10 and 35 seconds to give user a chance but keep pressure
      const thinkTime = Math.random() * 25000 + 10000;
      gameLoopRef.current = setTimeout(() => {
        // AI picks one answer
        handleAIWin(answers[0]);
      }, thinkTime);
    } else {
        console.warn("AI found no answers for this matchup.");
        // Optional: Could display a message saying AI is stumped, giving user infinite time.
    }
  };

  const handleAIWin = (answer: string) => {
    setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    setMessages(prev => [...prev, { text: `🤖 AI answered: ${answer}`, isError: true }]);
    setGameState(GameState.ROUND_END);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !userTeam || !opponentTeam) return;

    const answer = inputValue.trim();
    setInputValue('');
    
    // UI Feedback immediately
    setMessages(prev => [...prev, { text: `Checking ${answer}...` }]);

    // 1. Optimistic check (if AI already found it)
    const isKnownValid = aiPotentialAnswers.current.some(a => a.toLowerCase().includes(answer.toLowerCase()));
    
    if (isKnownValid) {
       handleSuccess(answer, 'AI Match', []);
       return;
    }

    // 2. Full Verification (Local DB -> then AI)
    const result = await verifyAnswer(userTeam.name, opponentTeam.name, answer);

    if (result.isValid) {
      handleSuccess(answer, result.source || 'Verified', result.history);
    } else {
      setMessages(prev => [...prev, { text: `❌ ${answer} is incorrect`, isError: true }]);
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
    setOpponentTeam(null);
    setMessages([]);
    setTimeLeft(30);
    setGameState(GameState.SELECTION);
  };

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
        <div className="flex-1 flex flex-col">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Select Your Team</h2>
            <div className="inline-block bg-[#0F1419] border border-[#0066CC] text-[#0066CC] px-4 py-1 rounded-full font-mono font-bold">
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-20 pr-1 max-h-[60vh]">
            {TEAMS.map(team => (
              <TeamCard 
                key={team.id}
                team={team}
                selected={userTeam?.id === team.id}
                onClick={() => setUserTeam(team)}
              />
            ))}
          </div>
          <div className="fixed bottom-6 left-0 right-0 px-6 max-w-lg mx-auto">
            <Button fullWidth onClick={startReveal} disabled={!userTeam}>Confirm Selection</Button>
          </div>
        </div>
      )}

      {/* PHASE: REVEAL */}
      {gameState === GameState.REVEAL && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-pulse">
          <h2 className="text-3xl font-bold">MATCHUP</h2>
          <div className="w-full flex items-center justify-between px-4">
             <div className="text-center">
                <div className="w-24 h-24 rounded-full mb-2 border-4 border-white shadow-xl mx-auto"
                  style={{ background: `linear-gradient(135deg, ${userTeam?.colors[0]}, ${userTeam?.colors[1]})` }} />
                <p className="font-bold text-xl">{userTeam?.name}</p>
             </div>
             <div className="text-4xl font-mono font-bold text-gray-500">VS</div>
             <div className="text-center">
                <div className="w-24 h-24 rounded-full mb-2 border-4 border-white shadow-xl mx-auto"
                  style={{ background: `linear-gradient(135deg, ${opponentTeam?.colors[0]}, ${opponentTeam?.colors[1]})` }} />
                <p className="font-bold text-xl">{opponentTeam?.name}</p>
             </div>
          </div>
        </div>
      )}

      {/* PHASE: PLAYING */}
      {(gameState === GameState.PLAYING || gameState === GameState.ROUND_END) && (
        <div className="flex-1 flex flex-col">
           <div className="bg-[#1E2732] rounded-xl p-4 mb-6 border border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full" style={{ background: userTeam?.colors[0] }} />
                <span className="font-bold">{userTeam?.name}</span>
              </div>
              <span className="text-gray-500 font-mono text-xs">CROSSOVER</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-right">{opponentTeam?.name}</span>
                <div className="w-8 h-8 rounded-full" style={{ background: opponentTeam?.colors[0] }} />
              </div>
           </div>

           <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm font-medium flex flex-col ${
                    msg.isSuccess ? 'bg-green-500/20 text-green-200 border border-green-500/50' : 
                    msg.isError ? 'bg-red-500/20 text-red-200 border border-red-500/50' : 
                    'bg-gray-800 text-gray-300'
                  }`}>
                  <div className="flex justify-between items-center w-full">
                    <span>{msg.text}</span>
                    {msg.source && <span className="text-[10px] opacity-75 font-mono border border-current px-1 rounded">{msg.source === 'LOCAL' ? '⚡ DB' : '🤖 AI'}</span>}
                  </div>
                  {/* Display History if available */}
                  {msg.history && msg.history.length > 0 && (
                    <div className="mt-2 pl-2 border-l-2 border-green-500/30 text-xs opacity-90 space-y-1">
                      {msg.history.map((h, i) => (
                        <div key={i}>{h}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
           </div>

           {gameState === GameState.PLAYING ? (
             <form onSubmit={handleUserSubmit} className="mt-auto">
               <div className="relative">
                 <input
                   ref={inputRef}
                   type="text"
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   className="w-full bg-[#0F1419] border-2 border-[#0066CC] rounded-xl px-4 py-4 text-lg font-bold text-white focus:outline-none focus:ring-4 focus:ring-[#0066CC]/30 placeholder-gray-600"
                   placeholder="Type surname..."
                   autoComplete="off"
                   autoFocus
                 />
                 <button type="submit" className="absolute right-2 top-2 bottom-2 bg-[#0066CC] px-4 rounded-lg font-bold">GO</button>
               </div>
             </form>
           ) : (
             <div className="mt-auto space-y-3">
               <div className="bg-[#1E2732] p-4 rounded-xl text-center">
                 <h3 className="text-xl font-bold text-white">
                   {messages.find(m => m.isSuccess) ? 'Point for You!' : 'Point for AI'}
                 </h3>
               </div>
               <Button fullWidth onClick={nextRound}>Next Round</Button>
               <Button fullWidth variant="secondary" onClick={() => navigate('/')}>Back to Menu</Button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GamePage;