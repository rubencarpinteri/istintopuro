import { Peer, DataConnection } from "peerjs";
import { P2PMessage } from "../types";

class P2PService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private messageHandlers: ((msg: P2PMessage) => void)[] = [];
  private disconnectHandler: (() => void) | null = null;
  
  public myId: string = '';
  public isHost: boolean = false;
  public opponentName: string = 'Opponent';

  // --- CONFIGURATION ---
  private readonly PEER_CONFIG = {
    debug: 1, // Minimal logs
    secure: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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
   * Tries to find a free room code.
   */
  public startHostSession(username: string): Promise<string> {
    // Ensure thorough cleanup before starting new session
    this.destroy();
    this.isHost = true;

    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 5;

      const tryInit = () => {
        attempts++;
        if (attempts > maxAttempts) {
          reject(new Error("Could not generate a unique room code. Try again."));
          return;
        }

        const shortCode = this.generateCode();
        const fullId = this.getFullId(shortCode);
        
        console.log(`P2P: Attempting to host (Try ${attempts}) with ID: ${fullId}`);

        const tempPeer = new Peer(fullId, this.PEER_CONFIG);

        // 1. Successful Open
        tempPeer.on('open', (id) => {
          console.log("P2P: Host Session Created:", id);
          this.peer = tempPeer;
          this.myId = id;
          this.setupHostListeners(username);
          resolve(shortCode);
        });

        // 2. Error Handling
        tempPeer.on('error', (err: any) => {
          console.warn("P2P Init Error:", err.type);
          if (err.type === 'unavailable-id') {
            // ID taken, retry immediately
            tempPeer.destroy();
            setTimeout(tryInit, 50); 
          } else if (err.type === 'server-error' || err.type === 'socket-error') {
             // Network fluctuation, retry with slight backoff
             tempPeer.destroy();
             setTimeout(tryInit, 500);
          } else {
            // Serious fatal error
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
      this.setupConnectionEvents(conn, username);
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
                this.setupConnectionEvents(conn, username);
                
                // Send handshake immediately
                this.send('HANDSHAKE', { username });
                resolve();
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                console.error("P2P Connection Error:", err);
                reject(err);
            });
            
            // Peer specific errors
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

  // --- SHARED CONNECTION LOGIC ---

  private setupConnectionEvents(conn: DataConnection, myUsername: string) {
    conn.on('data', (data: any) => this.handleIncomingData(data));
    
    conn.on('close', () => {
         console.log("P2P: Connection closed remotely");
         this.handleDisconnect();
    });

    conn.on('error', (err) => {
        console.error("P2P: Data Connection Error", err);
        this.handleDisconnect();
    });
  }

  private handleIncomingData(data: any) {
    const msg = data as P2PMessage;
    
    if (msg.type === 'HANDSHAKE') {
       this.opponentName = msg.payload.username;
       // If I am host, I reply with handshake to confirm connection
       if (this.isHost) {
           // We don't need to explicitly reply, but ensuring opponent knows my name is handled by lobby logic or implicit state
       }
    }

    this.messageHandlers.forEach(h => h(msg));
  }

  private handleDisconnect() {
      // Notify listeners (UI) that opponent is gone
      if (this.disconnectHandler) {
          this.disconnectHandler();
      }
      // Also inject a message for internal logic
      this.messageHandlers.forEach(h => h({ type: 'OPPONENT_DISCONNECT', payload: {} }));
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

  public onDisconnect(handler: () => void) {
      this.disconnectHandler = handler;
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
    this.disconnectHandler = null;
    this.isHost = false;
  }
}

export const p2pManager = new P2PService();