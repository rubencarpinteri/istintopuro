import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCpuOptions, setShowCpuOptions] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState<number | null>(null);

  const handleMatchSelect = (rounds: number) => {
    if (selectedRounds !== null) return; // Prevent multiple clicks
    setSelectedRounds(rounds);
    
    // Delay navigation to show the lock animation
    setTimeout(() => {
        navigate(`/game?mode=ai&bestOf=${rounds}`);
    }, 1200);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen p-4 flex flex-col justify-center relative z-10">
      
      {/* Retro Header */}
      <header className="mb-12 text-center">
        <div className="retro-box p-6 bg-blue-900 mb-6">
            <h1 className="text-2xl font-pixel text-yellow-400 leading-normal text-shadow-black">
            ISTINTO PURO<br/>
            <span className="text-white text-lg">CALCIO</span>
            </h1>
        </div>
        <p className="text-green-400 font-pixel text-[10px] tracking-widest blink uppercase">CLICK BUTTON TO START</p>
      </header>

      {/* Main Actions */}
      <main className="flex-1 flex flex-col gap-6">
        <div className="space-y-4 px-4">
            {showCpuOptions ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300 bg-black/40 p-4 rounded border border-gray-700">
                <div className="text-center font-pixel text-xs text-yellow-400 mb-2">SELECT MATCH LENGTH</div>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map(rounds => {
                    const isLocked = selectedRounds === rounds;
                    const isDisabled = selectedRounds !== null && !isLocked;

                    return (
                        <button 
                            key={rounds}
                            onClick={() => handleMatchSelect(rounds)}
                            disabled={selectedRounds !== null}
                            className={`
                                relative font-pixel text-[10px] py-3 border-4 uppercase tracking-widest transition-all duration-200
                                ${isLocked 
                                    ? 'bg-yellow-900/80 border-yellow-400 text-yellow-100 shadow-[0_0_15px_rgba(250,204,21,0.6)] scale-105 z-20' 
                                    : isDisabled
                                        ? 'bg-gray-800 border-gray-700 text-gray-600 shadow-none opacity-50 cursor-not-allowed'
                                        : 'bg-blue-900 border-slate-400 text-white shadow-[4px_4px_0px_0px_#000] hover:bg-blue-800 hover:border-slate-200 hover:-translate-y-1 active:translate-y-0 active:shadow-none'
                                }
                            `}
                        >
                            BO{rounds}
                            {isLocked && (
                                <>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 rotate-[-10deg] border-2 border-yellow-400 px-1 bg-black/80 z-20 shadow-lg">
                                        <span className="font-pixel text-[6px] text-yellow-400 animate-pulse">LOCKED</span>
                                    </div>
                                    {/* Scanline overlay */}
                                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%]"></div>
                                </>
                            )}
                        </button>
                    );
                  })}
                </div>
                <Button 
                    fullWidth 
                    variant="ghost" 
                    onClick={() => {
                        if (selectedRounds === null) setShowCpuOptions(false);
                    }}
                    disabled={selectedRounds !== null}
                    className="text-[10px] py-2 text-gray-400 hover:text-white mt-2"
                >
                    CANCEL
                </Button>
              </div>
            ) : (
                <Button 
                  fullWidth 
                  onClick={() => setShowCpuOptions(true)} 
                  className="text-base"
                >
                  1P VS CPU
                </Button>
            )}

            <Button 
              fullWidth 
              onClick={() => navigate('/lobby')} 
              variant="primary" 
              className="text-base bg-purple-700 hover:bg-purple-600 border-purple-300"
              disabled={selectedRounds !== null}
            >
              2P VS FRIEND
            </Button>
            <Button 
                fullWidth 
                onClick={() => navigate('/profile')} 
                variant="secondary" 
                className="text-base border-gray-400"
                disabled={selectedRounds !== null}
            >
              MEMORY CARD (STATS)
            </Button>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-600 py-6 font-pixel">
        <p>© 1988-2026 OFF SPORTS</p>
        <button 
          onClick={() => navigate('/convert')} 
          className="mt-2 hover:text-white underline decoration-dashed"
          disabled={selectedRounds !== null}
        >
          [DB EDITOR]
        </button>
      </footer>
    </div>
  );
};

export default HomePage;