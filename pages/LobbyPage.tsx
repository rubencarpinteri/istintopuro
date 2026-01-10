import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { p2pManager } from '../services/p2pService';
import { storageService } from '../services/storageService';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  // Initialize with storage service username or localstorage fallback
  const [username, setUsername] = useState(storageService.getStats().username || '');
  const [roomCode, setRoomCode] = useState(''); // For joining
  const [myRoomCode, setMyRoomCode] = useState(''); // If hosting
  const [status, setStatus] = useState<'idle' | 'initializing' | 'waiting' | 'connecting'>('idle');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'host' | 'join'>('host');

  useEffect(() => {
    // Ensure we start fresh
    p2pManager.destroy();
  }, []);

  const handleInit = async () => {
    if (!username.trim()) {
      setError('ENTER NICKNAME');
      return;
    }
    setError(''); // Clear previous errors
    storageService.updateUsername(username);
    
    try {
      setStatus('initializing');
      const id = await p2pManager.init(username);
      
      if (mode === 'host') {
        p2pManager.isHost = true;
        setMyRoomCode(id);
        setStatus('waiting');
        
        // Listen for incoming connection
        p2pManager.onMessage((msg) => {
             if (msg.type === 'HANDSHAKE' || msg.type === 'START_GAME') {
                 navigate('/game?mode=p2p');
             }
        });
      } else {
        // Init done, now ready to join
        setStatus('idle'); 
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'CONNECTION FAILED');
      setStatus('idle');
    }
  };

  const handleJoin = async () => {
    if (!roomCode) return;
    setError('');
    
    try {
      setStatus('connecting');
      // If peer not init, do it now
      if (!p2pManager.myId) {
          await p2pManager.init(username);
      }
      await p2pManager.connect(roomCode, username);
      // Wait for connection to open
      setTimeout(() => {
         navigate('/game?mode=p2p');
      }, 500);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'INVALID CODE OR ERROR');
      setStatus('idle');
    }
  };

  const handleCancel = () => {
      p2pManager.destroy();
      setStatus('idle');
      setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] font-pixel text-white p-4">
       <div className="max-w-md w-full space-y-6">
          <div className="text-center mb-8">
             <h1 className="text-3xl text-yellow-400 mb-2">MULTIPLAYER</h1>
             <p className="text-xs text-gray-400">CONNECT DIRECTLY P2P</p>
          </div>

          {/* Username Input */}
          <div className="space-y-2">
            <label className="text-xs text-blue-300">YOUR NICKNAME</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full bg-black border-2 border-blue-500 p-3 text-center text-xl text-white outline-none focus:border-white"
              placeholder="PLAYER 1"
              disabled={status !== 'idle'}
            />
          </div>

          {status === 'idle' ? (
              <>
                 <div className="flex gap-2">
                    <button 
                        onClick={() => setMode('host')}
                        className={`flex-1 py-4 border-2 transition-all ${mode === 'host' ? 'bg-blue-700 border-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}
                    >
                        HOST GAME
                    </button>
                    <button 
                        onClick={() => setMode('join')}
                        className={`flex-1 py-4 border-2 transition-all ${mode === 'join' ? 'bg-green-700 border-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}
                    >
                        JOIN GAME
                    </button>
                 </div>

                 {mode === 'host' ? (
                     <div className="text-center p-4 border-2 border-dashed border-gray-700 bg-black/50">
                        <p className="text-xs text-gray-400 mb-4">CREATE A ROOM CODE TO SHARE</p>
                        <Button fullWidth onClick={handleInit}>CREATE ROOM</Button>
                     </div>
                 ) : (
                     <div className="text-center p-4 border-2 border-dashed border-gray-700 bg-black/50 space-y-4">
                        <p className="text-xs text-gray-400">ENTER FRIEND'S CODE</p>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                            <input 
                                type="text" 
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                                className="flex-1 bg-black/20 border-2 border-green-500 p-3 text-center text-lg text-white/20 placeholder:text-white/20 outline-none focus:bg-black/40 min-w-0"
                                placeholder="CODE"
                            />
                            <Button className="whitespace-nowrap" onClick={handleJoin}>JOIN</Button>
                        </div>
                     </div>
                 )}
              </>
          ) : (
             <div className="text-center space-y-6 py-8 border-4 border-white bg-blue-900 shadow-[8px_8px_0px_#000]">
                 {status === 'waiting' ? (
                     <>
                        <h3 className="text-xs text-blue-200 mb-2">SHARE THIS CODE</h3>
                        <div className="text-4xl font-bold tracking-widest text-yellow-300 animate-pulse select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(myRoomCode)}>
                            {myRoomCode}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-4">WAITING FOR CHALLENGER...</p>
                        <button onClick={handleCancel} className="text-xs text-red-300 underline mt-2">CANCEL</button>
                     </>
                 ) : (
                     <div className="flex flex-col items-center">
                         <div className="text-lg animate-pulse mb-4">CONNECTING...</div>
                         <button onClick={handleCancel} className="text-xs text-red-300 underline">CANCEL</button>
                     </div>
                 )}
             </div>
          )}
          
          {error && <p className="text-red-500 text-center text-xs bg-red-900/50 p-2 border border-red-500 animate-pulse">{error}</p>}

          <button onClick={() => navigate('/')} className="w-full text-center text-xs text-gray-500 hover:text-white mt-8">
              « BACK TO MENU
          </button>
       </div>
    </div>
  );
};

export default LobbyPage;