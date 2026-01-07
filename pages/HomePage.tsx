import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { MOCK_HISTORY } from '../constants';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto min-h-screen p-4 flex flex-col justify-center relative z-10">
      
      {/* Retro Header */}
      <header className="mb-12 text-center">
        <div className="retro-box p-6 bg-blue-900 mb-6">
            <h1 className="text-4xl font-pixel text-yellow-400 leading-normal text-shadow-black">
            CALCIO<br/>
            <span className="text-white text-2xl">MANAGER 98</span>
            </h1>
        </div>
        <p className="text-green-400 font-mono text-xl blink">INSERT COIN TO START</p>
      </header>

      {/* Main Actions */}
      <main className="flex-1 flex flex-col gap-6">
        <div className="space-y-4 px-4">
            <Button fullWidth onClick={() => navigate('/game?mode=ai')} className="text-sm">
              1P VS CPU (GEMINI)
            </Button>
            <Button fullWidth variant="secondary" disabled title="Coming soon">
              2P VS PLAYER
            </Button>
        </div>

        {/* History Preview (Arcade High Scores style) */}
        <div className="mt-8 border-t-2 border-dashed border-gray-600 pt-4">
          <h2 className="text-center font-pixel text-xs text-gray-400 mb-4">LAST MATCHES</h2>
          <div className="space-y-2 text-sm font-mono">
            {MOCK_HISTORY.map((match) => (
              <div key={match.id} className="flex items-center justify-between p-2 bg-black border border-gray-700 text-green-500">
                <span>{match.opponent.substring(0, 10)}</span>
                <span className={match.result === 'WIN' ? 'text-yellow-400' : 'text-red-500'}>
                    {match.score} {match.result.substring(0,1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-600 py-6 font-pixel">
        <p>© 1998-2025 GEMINI SPORTS</p>
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