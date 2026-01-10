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
  const [status, setStatus] = useState<'idle' | 'initializing' | 'waiting' | 'connecting'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'host' | 'join'>('host');

  useEffect(() => {
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
      setStatusMsg('FINDING EMPTY FREQUENCY...');
      
      // This automatically retries until it finds a free code
      const code = await p2pManager.startHostSession(username);
      
      setMyRoomCode(code);
      setStatus('waiting');
      setStatusMsg('');
      
      // Wait for player
      p2pManager.onMessage((msg) => {
           if (msg.type === 'HANDSHAKE' || msg.type === 'START_GAME') {
               navigate('/game?mode=p2p');
           }
      });
    } catch (e: any) {
      console.error(e);
      setError('SERVER ERROR. TRY AGAIN.');
      setStatus('idle');
    }
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
      setStatusMsg('INITIALIZING...');

      // 1. Initialize Guest (get random ID)
      if (!p2pManager.myId) {
          await p2pManager.startGuestSession(username); 
      }
      
      // 2. Connect to Host
      setStatusMsg(`SEARCHING FOR ${roomCode.toUpperCase()}...`);
      await p2pManager.connectToRoom(roomCode.toUpperCase(), username);
      
      // Success, move to game
      setTimeout(() => {
         navigate('/game?mode=p2p');
      }, 500);

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'CONNECTION FAILED');
      setStatus('idle');
      // Do not destroy p2pManager here, user might retry with a fixed code
    }
  };

  const handleCancel = () => {
      p2pManager.destroy();
      setStatus('idle');
      setError('');
      setStatusMsg('');
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
                        <p className="text-xs text-gray-400 mb-4">GENERATE A ROOM CODE</p>
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
                        <p className="text-[10px] text-gray-400 mt-4">WAITING FOR CHALLENGER...</p>
                     </>
                 ) : (
                     <div className="flex flex-col items-center">
                         <div className="text-xs font-pixel text-green-400 mb-2 animate-bounce">
                             {status === 'initializing' ? '📡' : '🔗'}
                         </div>
                         <div className="text-sm animate-pulse mb-4 text-yellow-300">{statusMsg || 'CONNECTING...'}</div>
                     </div>
                 )}
                 <button onClick={handleCancel} className="text-xs text-red-300 underline mt-4">CANCEL</button>
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