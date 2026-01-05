import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { MOCK_HISTORY } from '../constants';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto min-h-screen p-6 flex flex-col relative z-10">
      {/* Header */}
      <header className="py-8 text-center space-y-2">
        <div className="inline-block p-3 rounded-full bg-[#0066CC]/10 mb-4 border border-[#0066CC]/20">
          <span className="text-3xl">⚽</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          CALCIO <span className="text-[#0066CC]">MINIGAME</span>
        </h1>
        <p className="text-gray-400 font-mono text-sm">SERIE A CROSSOVER CHALLENGE</p>
      </header>

      {/* Main Actions */}
      <main className="flex-1 flex flex-col gap-4 justify-center py-8">
        <div className="bg-[#1E2732] rounded-2xl p-6 border border-gray-800 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-8 bg-[#0066CC] rounded-full"></span>
            Play Now
          </h2>
          <div className="space-y-3">
            <Button fullWidth onClick={() => navigate('/game?mode=ai')}>
              🤖 VS AI (Gemini)
            </Button>
            <Button fullWidth variant="secondary" disabled title="Coming soon">
              👥 VS Friend (Offline)
            </Button>
            <Button fullWidth variant="secondary" disabled title="Coming soon">
              🎲 Random Opponent
            </Button>
          </div>
        </div>

        {/* History Preview */}
        <div className="bg-[#1E2732] rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold mb-4 text-gray-300">Recent Matches</h2>
          <div className="space-y-3">
            {MOCK_HISTORY.map((match) => (
              <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0F1419] border border-gray-800">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{match.opponent}</span>
                  <span className="text-xs text-gray-500">{match.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono font-bold ${match.result === 'WIN' ? 'text-green-500' : 'text-red-500'}`}>
                    {match.result}
                  </span>
                  <span className="bg-[#1E2732] px-2 py-1 rounded text-xs font-mono">
                    {match.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-600 py-4 flex flex-col gap-2">
        <span>v2.5.0 • Powered by Gemini AI</span>
        <button 
          onClick={() => navigate('/convert')} 
          className="text-gray-700 hover:text-gray-500 underline decoration-dotted transition-colors"
        >
          Manage Data / Upload CSVs
        </button>
      </footer>
    </div>
  );
};

export default HomePage;