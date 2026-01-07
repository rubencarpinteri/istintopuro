import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

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
        <p className="text-green-400 font-pixel text-[10px] tracking-widest blink uppercase">INSERT COIN TO START</p>
      </header>

      {/* Main Actions */}
      <main className="flex-1 flex flex-col gap-6">
        <div className="space-y-4 px-4">
            <Button fullWidth onClick={() => navigate('/game?mode=ai')} className="text-sm">
              1P VS CPU
            </Button>
            <Button fullWidth variant="secondary" disabled title="Coming soon">
              2P VS PLAYER
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