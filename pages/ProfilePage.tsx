import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(storageService.getStats());
  const [importCode, setImportCode] = useState('');
  const [message, setMessage] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setStats(storageService.getStats());
  }, []);

  const handleCopy = () => {
    const code = storageService.exportData();
    navigator.clipboard.writeText(code);
    setMessage('CODE COPIED TO CLIPBOARD!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImport = () => {
    if (!importCode) return;
    const success = storageService.importData(importCode);
    if (success) {
        setStats(storageService.getStats());
        setMessage('DATA RESTORED SUCCESSFULLY!');
        setImportCode('');
        setShowImport(false);
    } else {
        setMessage('INVALID CODE');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const winRate = stats.wins + stats.losses > 0 
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white font-pixel p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-700 pb-4 mt-4">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">« MENU</button>
            <h1 className="text-xl text-yellow-400">MEMORY CARD</h1>
        </div>

        {/* Stats Card */}
        <div className="retro-box bg-gray-900 p-6 space-y-4">
            <div className="text-center border-b border-gray-700 pb-4">
                <p className="text-xs text-gray-500 mb-1">LICENSE HOLDER</p>
                <h2 className="text-2xl text-blue-400 uppercase">{stats.username}</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/50 p-2 border border-green-900">
                    <p className="text-[10px] text-gray-500">WINS</p>
                    <p className="text-xl text-green-500">{stats.wins}</p>
                </div>
                <div className="bg-black/50 p-2 border border-red-900">
                    <p className="text-[10px] text-gray-500">LOSSES</p>
                    <p className="text-xl text-red-500">{stats.losses}</p>
                </div>
                 <div className="bg-black/50 p-2 border border-yellow-900">
                    <p className="text-[10px] text-gray-500">RATE</p>
                    <p className="text-xl text-yellow-500">{winRate}%</p>
                </div>
            </div>
        </div>

        {/* Data Transfer Section */}
        <div className="space-y-4">
            <div className="bg-[#1a1a1a] p-4 border-2 border-dashed border-gray-600">
                <h3 className="text-sm text-center mb-4 text-cyan-400">DATA TRANSFER</h3>
                
                {!showImport ? (
                    <div className="flex gap-2">
                        <Button fullWidth variant="primary" onClick={handleCopy} className="text-[10px]">
                            COPY SAVE CODE
                        </Button>
                        <Button fullWidth variant="secondary" onClick={() => setShowImport(true)} className="text-[10px]">
                            LOAD SAVE CODE
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <textarea 
                            value={importCode}
                            onChange={(e) => setImportCode(e.target.value)}
                            placeholder="PASTE YOUR CODE HERE..."
                            className="w-full h-24 bg-black border border-green-500 text-green-500 text-[10px] p-2 focus:outline-none"
                        />
                        <div className="flex gap-2">
                            <Button fullWidth variant="primary" onClick={handleImport}>RESTORE</Button>
                            <Button fullWidth variant="ghost" onClick={() => setShowImport(false)}>CANCEL</Button>
                        </div>
                    </div>
                )}

                {message && <p className="text-center text-xs text-green-400 mt-2 blink">{message}</p>}
                
                <p className="text-[10px] text-gray-500 mt-4 text-center leading-tight">
                    * COPY THE CODE TO SAVE YOUR PROGRESS.<br/>
                    * PASTE IT ON ANOTHER DEVICE TO RESTORE IT.
                </p>
            </div>
        </div>

        {/* Match History */}
        <div className="space-y-2">
            <h3 className="text-xs text-gray-400">RECENT MATCHES</h3>
            <div className="space-y-1 h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
                {stats.matches.length === 0 ? (
                    <p className="text-center text-gray-600 text-xs py-4">NO MATCHES RECORDED</p>
                ) : (
                    stats.matches.map((match, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-900 p-2 border-l-2 border-gray-700 text-xs">
                            <span className="text-gray-400 w-20">{new Date(match.date).toLocaleDateString()}</span>
                            <span className="flex-1 truncate px-2 text-white">{match.team} vs {match.opponent}</span>
                            <span className={match.result === 'WIN' ? 'text-green-500' : 'text-red-500'}>{match.result}</span>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;