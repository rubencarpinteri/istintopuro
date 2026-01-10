import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCpuOptions, setShowCpuOptions] = useState(false);

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
                  {[3, 5, 10].map(rounds => (
                    <Button 
                      key={rounds}
                      onClick={() => navigate(`/game?mode=ai&bestOf=${rounds}`)}
                      className="text-[10px] py-3 bg-blue-900 border-slate-400 hover:bg-blue-800 hover:border-slate-200 text-white shadow-[4px_4px_0px_0px_#000]"
                      variant="primary"
                    >
                      BO{rounds}
                    </Button>
                  ))}
                </div>
                <Button 
                    fullWidth 
                    variant="ghost" 
                    onClick={() => setShowCpuOptions(false)}
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
            >
              2P VS FRIEND
            </Button>
            <Button fullWidth onClick={() => navigate('/profile')} variant="secondary" className="text-base border-gray-400">
              MEMORY CARD (STATS)
            </Button>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-600 py-6 font-pixel">
        <p>© 1988-2026 OFF SPORTS</p>
        <button 
          onClick={() => navigate('/convert')} 
          className="mt-2 hover:text-white underline decoration-dashed"
        >
          [DB EDITOR]
        </button>
      </footer>
    </div>
  );
};

export default HomePage;