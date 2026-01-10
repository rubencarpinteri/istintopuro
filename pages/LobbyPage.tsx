import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { p2pManager } from '../services/p2pService';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState(localStorage.getItem('calcio_username') || '');
  const [roomCode, setRoomCode] = useState(''); // For joining
  const [myRoomCode, setMyRoomCode] = useState(''); // If hosting
  const [status, setStatus] = useState<'idle' | 'initializing' | 'waiting' | 'connecting'>('idle');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'host' | 'join'>('host');

  useEffect(() => {
    // Check if we are already connected (back navigation)
    if (p2pManager.myId) {
       // Optional: could reset or keep session
    }
  }, []);

  const handleInit = async () => {
    if (!username.trim()) {
      setError('ENTER NICKNAME');
      return;
    }
    localStorage.setItem('calcio_username', username);
    
    try {
      setStatus('initializing');
      const id = await p2pManager.init(username);
      
      if (mode === 'host') {
        p2pManager.isHost = true;
        setMyRoomCode(id);
        setStatus('waiting');
        
        // Listen for incoming connection
        p2pManager.onMessage((msg) => {
             // As soon as we get a message (likely HANDSHAKE), go to game
             if (msg.type === 'HANDSHAKE' || msg.type === 'START_GAME') {
                 navigate('/game?mode=p2p');
             }
        });
      } else {
        // Join mode - waiting for user to type code
        setStatus('idle'); 
      }
    } catch (e) {
      console.error(e);
      setError('CONNECTION FAILED');
      setStatus('idle');
    }
  };

  const handleJoin = async () => {
    if (!roomCode) return;
    try {
      setStatus('connecting');
      await p2pManager.connect(roomCode, username);
      // Wait for connection to open
      setTimeout(() => {
         navigate('/game?mode=p2p');
      }, 500);
    } catch (e) {
      setError('INVALID CODE OR CONNECTION ERROR');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#000022] font-pixel text-white p-4">
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
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                                className="flex-1 bg-black border-2 border-green-500 p-2 text-center text-lg"
                                placeholder="CODE"
                            />
                            <Button onClick={() => {
                                if (!p2pManager.myId) {
                                    handleInit().then(() => handleJoin());
                                } else {
                                    handleJoin();
                                }
                            }}>JOIN</Button>
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
                     </>
                 ) : (
                     <div className="text-lg animate-pulse">CONNECTING...</div>
                 )}
             </div>
          )}
          
          {error && <p className="text-red-500 text-center text-xs bg-red-900/50 p-2 border border-red-500">{error}</p>}

          <button onClick={() => navigate('/')} className="w-full text-center text-xs text-gray-500 hover:text-white mt-8">
              « BACK TO MENU
          </button>
       </div>
    </div>
  );
};

export default LobbyPage;