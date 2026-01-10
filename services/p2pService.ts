import { Peer, DataConnection } from "peerjs";
import { P2PMessage } from "../types";

class P2PService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private messageHandlers: ((msg: P2PMessage) => void)[] = [];
  
  public myId: string = '';
  public isHost: boolean = false;
  public opponentName: string = 'Opponent';

  // --- CONFIGURATION ---
  private readonly PEER_CONFIG = {
    debug: 0, // Turn off verbose logs to clean up console
    secure: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    }
  };

  private generateCode(): string {
    // 4 Random Letters/Numbers
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  private getFullId(code: string): string {
    return `CMG-${code}`;
  }

  // --- HOST LOGIC ---

  /**
   * Tries to find a free room code. If a code is taken, it automatically retries with a new one.
   * Returns a Promise that resolves with the SHORT code (e.g. "A1B2")
   */
  public startHostSession(username: string): Promise<string> {
    this.destroy();
    this.isHost = true;

    return new Promise((resolve, reject) => {
      const tryInit = () => {
        const shortCode = this.generateCode();
        const fullId = this.getFullId(shortCode);
        
        console.log("P2P: Trying to host with ID", fullId);

        const tempPeer = new Peer(fullId, this.PEER_CONFIG);

        // 1. Successful Open
        tempPeer.on('open', (id) => {
          console.log("P2P: Host Session Created:", id);
          this.peer = tempPeer;
          this.myId = id;
          this.setupHostListeners(username);
          resolve(shortCode); // Return only the short code to the UI
        });

        // 2. Error Handling (specifically unavailable ID)
        tempPeer.on('error', (err: any) => {
          if (err.type === 'unavailable-id') {
            console.warn(`P2P: ID ${fullId} taken, retrying...`);
            tempPeer.destroy();
            setTimeout(tryInit, 100); // Retry quickly
          } else {
            console.error("P2P: Host Error", err);
            // Serious network error
            reject(err);
          }
        });
      };

      tryInit();
    });
  }

  private setupHostListeners(username: string) {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      console.log('P2P: Guest connected!');
      
      // Close previous if any (only 1 guest allowed)
      if (this.conn && this.conn.open) {
        this.conn.close();
      }

      this.conn = conn;
      
      this.conn.on('open', () => {
        console.log("P2P: Pipe open. Sending handshake.");
        // Immediate Handshake
        this.conn?.send({ 
           type: 'HANDSHAKE', 
           payload: { username } 
        });
      });

      this.conn.on('data', (data: any) => this.handleIncomingData(data));
      
      this.conn.on('close', () => {
         console.log("P2P: Guest disconnected");
         this.conn = null;
      });
    });
  }

  // --- GUEST LOGIC ---

  public startGuestSession(username: string): Promise<void> {
    this.destroy();
    this.isHost = false;

    return new Promise((resolve, reject) => {
      // Guests just get a random ID from server
      this.peer = new Peer(undefined, this.PEER_CONFIG);

      this.peer.on('open', (id) => {
        console.log("P2P: Guest initialized with ID", id);
        this.myId = id;
        resolve();
      });

      this.peer.on('error', (err) => {
        console.error("P2P: Guest Init Error", err);
        reject(err);
      });
    });
  }

  public connectToRoom(shortCode: string, username: string): Promise<void> {
    if (!this.peer || this.peer.destroyed) {
       return Promise.reject(new Error("Peer not initialized"));
    }

    const hostId = this.getFullId(shortCode);
    console.log("P2P: Connecting to host...", hostId);

    // Close existing connection
    if (this.conn) {
        this.conn.close();
    }

    try {
        const conn = this.peer.connect(hostId, {
            metadata: { username },
            reliable: true
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Host unresponsive. Check room code."));
            }, 8000);

            conn.on('open', () => {
                clearTimeout(timeout);
                console.log("P2P: Connected to host!");
                this.conn = conn;
                this.conn.on('data', (data: any) => this.handleIncomingData(data));
                
                // As a guest, we send our name immediately upon open
                this.send('HANDSHAKE', { username });
                
                resolve();
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                console.error("P2P Connection Error:", err);
                reject(err);
            });
            
            // If the peer specifically says the user is missing
            this.peer?.on('error', (err: any) => {
                if (err.type === 'peer-unavailable') {
                    clearTimeout(timeout);
                    reject(new Error("Room not found. Check code."));
                }
            });
        });
    } catch (e) {
        return Promise.reject(e);
    }
  }

  // --- SHARED ---

  private handleIncomingData(data: any) {
    const msg = data as P2PMessage;
    // console.log("RX:", msg.type);

    if (msg.type === 'HANDSHAKE') {
       this.opponentName = msg.payload.username;
       console.log("Opponent:", this.opponentName);
    }

    this.messageHandlers.forEach(h => h(msg));
  }

  public send(type: any, payload: any) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type, payload });
    }
  }

  public onMessage(handler: (msg: P2PMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  public destroy() {
    if (this.conn) {
        this.conn.close();
        this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.messageHandlers = [];
    this.isHost = false;
  }
}

export const p2pManager = new P2PService();