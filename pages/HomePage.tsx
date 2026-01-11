import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  
  // View State: 'MENU' or 'SOLO_SETUP'
  const [view, setView] = useState<'MENU' | 'SOLO_SETUP'>('MENU');
  
  // Solo Setup State
  const [username, setUsername] = useState(storageService.getStats().username || 'PLAYER 1');
  const [bestOf, setBestOf] = useState<number>(3);

  const handleStartSolo = () => {
    if (!username.trim()) return;
    
    // Save username preference
    storageService.updateUsername(username);
    
    // Animate transition (optional delay)
    setTimeout(() => {
        navigate(`/game?mode=ai&bestOf=${bestOf}`);
    }, 200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] font-pixel text-white p-4 relative overflow-hidden">
      
      {/* Background Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-5" 
           style={{ 
             backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
             backgroundSize: '24px 24px' 
           }}>
      </div>

      <div className="max-w-md w-full space-y-6 z-10">
        
        {/* Header - Visible in Menu */}
        {view === 'MENU' && (
          <header className="mb-12 text-center animate-in fade-in duration-500">
            <div className="retro-box p-6 bg-blue-900 mb-6 transform rotate-1 hover:rotate-0 transition-transform">
                <h1 className="text-3xl sm:text-4xl font-pixel text-yellow-400 leading-normal text-shadow-black">
                ISTINTO PURO<br/>
                <span className="text-white text-xl sm:text-2xl">CALCIO</span>
                </h1>
            </div>
            <p className="text-green-400 font-pixel text-[10px] tracking-widest blink uppercase">
                PRESS START BUTTON
            </p>
          </header>
        )}

        {/* --- MAIN MENU VIEW --- */}
        {view === 'MENU' && (
           <main className="flex flex-col gap-4 animate-in slide-in-from-bottom-8 duration-500">
              <Button 
                fullWidth 
                onClick={() => setView('SOLO_SETUP')} 
                className="text-base h-16 border-blue-400"
              >
                1P VS CPU
              </Button>

              <Button 
                fullWidth 
                onClick={() => navigate('/lobby')} 
                variant="primary" 
                className="text-base h-16 bg-purple-700 hover:bg-purple-600 border-purple-300 shadow-[8px_8px_0px_#2a0a45]"
              >
                2P VS FRIEND
              </Button>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Button 
                    fullWidth 
                    onClick={() => navigate('/profile')} 
                    variant="secondary" 
                    className="text-xs border-gray-400"
                >
                  MEMORY CARD
                </Button>
                <Button 
                    fullWidth 
                    onClick={() => navigate('/convert')} 
                    variant="ghost" 
                    className="text-xs border-dashed border-gray-600 text-gray-500 hover:text-white"
                >
                  DB EDITOR
                </Button>
              </div>

              <footer className="text-center text-[10px] text-gray-600 mt-8 font-pixel">
                <p>© 1988-2026 OFF SPORTS</p>
              </footer>
           </main>
        )}

        {/* --- SOLO SETUP VIEW --- */}
        {view === 'SOLO_SETUP' && (
           <div className="animate-in zoom-in-95 duration-300 w-full space-y-6">
              <div className="text-center mb-6">
                 <h2 className="text-2xl text-yellow-400 mb-2">SINGLE PLAYER</h2>
                 <p className="text-xs text-gray-400">CONFIGURE MATCH</p>
              </div>

              {/* Username Input */}
              <div className="space-y-2">
                <label className="text-xs text-blue-300 block text-center">YOUR NICKNAME</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full bg-black border-4 border-blue-800 p-4 text-center text-xl text-white outline-none focus:border-blue-500 font-pixel shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                  placeholder="PLAYER 1"
                />
              </div>

              {/* Match Length */}
              <div className="p-6 border-2 border-dashed border-gray-700 bg-black/40 space-y-4">
                 <label className="text-xs text-gray-400 block text-center">MATCH LENGTH</label>
                 <div className="flex gap-3 justify-center">
                     {[3, 5, 10].map(val => (
                         <button
                             key={val}
                             onClick={() => setBestOf(val)}
                             className={`
                                flex-1 py-3 border-2 font-pixel text-sm transition-all
                                ${bestOf === val 
                                    ? 'bg-yellow-600 border-yellow-300 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-105' 
                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'}
                             `}
                         >
                             BO{val}
                         </button>
                     ))}
                 </div>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-3">
                 <Button 
                    fullWidth 
                    onClick={handleStartSolo} 
                    variant="primary"
                    className="h-16 text-lg bg-green-700 border-green-400 hover:bg-green-600 shadow-[8px_8px_0px_#003300]"
                 >
                    START MATCH
                 </Button>
                 
                 <button 
                    onClick={() => setView('MENU')} 
                    className="w-full text-center text-xs text-gray-500 hover:text-white py-4"
                 >
                    « CANCEL
                 </button>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default HomePage;