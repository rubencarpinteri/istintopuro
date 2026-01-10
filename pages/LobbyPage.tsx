import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { p2pManager } from '../services/p2pService';
import { storageService } from '../services/storageService';

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState(storageService.getStats().username || '');
  const [roomCode, setRoomCode] = useState(''); 
  const [myRoomCode, setMyRoomCode] = useState(''); 
  const [status, setStatus] = useState<'idle' | 'initializing' | 'waiting' | 'connecting' | 'ready'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'host' | 'join'>('host');
  const [bestOf, setBestOf] = useState<number>(3); // Default Best of 3

  useEffect(() => {
    // Ensure we start fresh
    p2pManager.destroy();
  }, []);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('ENTER NICKNAME');
      return;
    }
    setError('');
    storageService.updateUsername(username);
    
    try {
      setStatus('initializing');
      setStatusMsg('TUNING FREQUENCY...');
      
      const code = await p2pManager.startHostSession(username);
      
      setMyRoomCode(code);
      setStatus('waiting');
      setStatusMsg('WAITING FOR CHALLENGER...');
      
      // Wait for player to join
      p2pManager.onMessage((msg) => {
           if (msg.type === 'HANDSHAKE') {
               setStatus('ready');
               setStatusMsg(`${p2pManager.opponentName} CONNECTED!`);
           }
      });
    } catch (e: any) {
      console.error(e);
      setError('CONNECTION ERROR. RETRY.');
      setStatus('idle');
    }
  };

  const handleStartGame = () => {
      // Host starts the game and sends config
      p2pManager.send('START_GAME', { 
          matchConfig: { bestOf } 
      });
      navigate(`/game?mode=p2p&bestOf=${bestOf}`);
  };

  const handleJoinRoom = async () => {
    if (!username.trim()) {
       setError('ENTER NICKNAME');
       return;
    }
    if (!roomCode || roomCode.length < 4) {
        setError('INVALID CODE');
        return;
    }
    setError('');
    storageService.updateUsername(username);
    
    try {
      setStatus('connecting');
      setStatusMsg('SEARCHING SIGNAL...');

      if (!p2pManager.myId) {
          await p2pManager.startGuestSession(username); 
      }
      
      await p2pManager.connectToRoom(roomCode.toUpperCase(), username);
      
      setStatus('ready');
      setStatusMsg('CONNECTED! WAITING FOR HOST...');

      // Listen for Start Game command from Host
      p2pManager.onMessage((msg) => {
          if (msg.type === 'START_GAME') {
              const config = msg.payload.matchConfig;
              navigate(`/game?mode=p2p&bestOf=${config.bestOf}`);
          }
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'CONNECTION FAILED');
      setStatus('idle');
    }
  };

  const handleCancel = () => {
      p2pManager.destroy();
      setStatus('idle');
      setError('');
      setStatusMsg('');
      setMyRoomCode('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] font-pixel text-white p-4">
       <div className="max-w-md w-full space-y-6">
          <div className="text-center mb-8">
             <h1 className="text-3xl text-yellow-400 mb-2">MULTIPLAYER</h1>
             <p className="text-xs text-gray-400">CONNECT DIRECTLY P2P</p>
          </div>

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
                        HOST
                    </button>
                    <button 
                        onClick={() => setMode('join')}
                        className={`flex-1 py-4 border-2 transition-all ${mode === 'join' ? 'bg-green-700 border-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}
                    >
                        JOIN
                    </button>
                 </div>

                 {mode === 'host' ? (
                     <div className="p-4 border-2 border-dashed border-gray-700 bg-black/50 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs text-gray-400 block text-center">MATCH LENGTH</label>
                            <div className="flex gap-2 justify-center">
                                {[3, 5, 10].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setBestOf(val)}
                                        className={`px-4 py-2 border ${bestOf === val ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-black border-gray-600 text-gray-500'}`}
                                    >
                                        BEST OF {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button fullWidth onClick={handleCreateRoom}>CREATE ROOM</Button>
                     </div>
                 ) : (
                     <div className="text-center p-4 border-2 border-dashed border-gray-700 bg-black/50 space-y-4">
                        <p className="text-xs text-gray-400">ENTER HOST'S CODE</p>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                            <input 
                                type="text" 
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                                className="flex-1 bg-black/20 border-2 border-green-500 p-3 text-center text-lg text-white/20 placeholder:text-white/20 outline-none focus:bg-black/40 min-w-0"
                                placeholder="ABCD"
                                maxLength={4}
                            />
                            <Button className="whitespace-nowrap" onClick={handleJoinRoom}>JOIN</Button>
                        </div>
                     </div>
                 )}
              </>
          ) : (
             <div className="text-center space-y-6 py-8 border-4 border-white bg-blue-900 shadow-[8px_8px_0px_#000]">
                 {status === 'waiting' ? (
                     <>
                        <h3 className="text-xs text-blue-200 mb-2">SHARE THIS CODE</h3>
                        <div className="text-4xl sm:text-5xl font-bold tracking-widest text-yellow-300 animate-pulse select-all cursor-pointer">
                            {myRoomCode}
                        </div>
                        <div className="flex flex-col items-center gap-2 mt-4">
                            <p className="text-[10px] text-gray-400">WAITING FOR CHALLENGER...</p>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                     </>
                 ) : status === 'ready' ? (
                     <div className="space-y-4">
                         <div className="text-green-400 text-lg animate-bounce">✓ CONNECTED</div>
                         <div className="bg-black/40 p-4 mx-4 border border-white/20">
                             <p className="text-xs text-gray-400 mb-1">OPPONENT</p>
                             <p className="text-xl">{p2pManager.opponentName}</p>
                         </div>
                         {mode === 'host' ? (
                             <div className="px-4 pt-2">
                                <Button fullWidth onClick={handleStartGame} variant="primary" className="bg-yellow-600 border-yellow-300 hover:bg-yellow-500">
                                    START MATCH (BO{bestOf})
                                </Button>
                             </div>
                         ) : (
                             <p className="text-xs text-gray-400 animate-pulse">WAITING FOR HOST TO START...</p>
                         )}
                     </div>
                 ) : (
                     <div className="flex flex-col items-center">
                         <div className="text-xs font-pixel text-green-400 mb-2 animate-bounce">
                             {status === 'initializing' ? '📡' : '🔗'}
                         </div>
                         <div className="text-sm animate-pulse mb-4 text-yellow-300">{statusMsg || 'CONNECTING...'}</div>
                     </div>
                 )}
                 
                 <button onClick={handleCancel} className="text-xs text-red-300 underline mt-4 hover:text-red-100">
                     CANCEL CONNECTION
                 </button>
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