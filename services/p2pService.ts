import { Peer, DataConnection } from "peerjs";
import { P2PMessage } from "../types";

class P2PService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private messageHandlers: ((msg: P2PMessage) => void)[] = [];
  
  public myId: string = '';
  public isHost: boolean = false;
  public opponentName: string = 'Opponent';

  constructor() {
    this.myId = '';
  }

  // Generate a more unique ID to avoid collisions on the public PeerJS server
  // Format: CMG-XXXX-YY (Random alphanumeric)
  private generateId(): string {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestampPart = (Date.now() % 1000).toString().padStart(3, '0');
    return `CMG-${randomPart}${timestampPart}`;
  }

  public init(username: string): Promise<string> {
    this.destroy(); // Ensure clean state

    return new Promise((resolve, reject) => {
      let isResolved = false;

      // Timeout handler
      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
            isResolved = true;
            this.destroy();
            console.error("PeerJS: Init timed out - Server might be unreachable");
            reject(new Error("Connection timed out. Retrying might work."));
        }
      }, 15000); // 15 seconds

      try {
          const customId = this.generateId();
          console.log("PeerJS: Attempting to connect with ID", customId);

          this.peer = new Peer(customId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            }
          });
      } catch (e) {
          isResolved = true;
          clearTimeout(timeoutTimer);
          reject(e);
          return;
      }

      // -- Event Handlers --

      this.peer.on('open', (id) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutTimer);
        console.log('PeerJS: Connected to server. ID:', id);
        this.myId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        console.log('PeerJS: Incoming connection from', conn.peer);
        this.handleConnection(conn, username);
      });

      this.peer.on('disconnected', () => {
        console.warn('PeerJS: Disconnected from signaling server.');
        // Auto-reconnect if we are already established, otherwise let it fail
        if (this.peer && !this.peer.destroyed && isResolved) {
            this.peer.reconnect();
        }
      });

      this.peer.on('close', () => {
        console.log('PeerJS: Connection closed.');
        this.conn = null;
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Error:', err.type, err.message);
        
        // If we get an "unavailable-id" error, it means collision. We should probably retry.
        if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutTimer);
            reject(new Error(`Connection failed: ${err.type}`));
        }
      });
    });
  }

  public connect(hostId: string, username: string): Promise<void> {
    // If peer not initialized, we must init first (with a random ID, doesn't matter for joiner)
    if (!this.peer || this.peer.destroyed) {
         return this.init(username).then(() => this.connect(hostId, username));
    }

    this.isHost = false;
    // Close existing connection if any
    if (this.conn) {
        this.conn.close();
    }

    console.log("PeerJS: Connecting to host", hostId);

    try {
        const conn = this.peer.connect(hostId, {
          metadata: { username },
          reliable: true
        });

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
              reject(new Error("Connection to host timed out. Check the code."));
          }, 10000);

          conn.on('open', () => {
            clearTimeout(timeout);
            console.log("PeerJS: DataConnection opened to", hostId);
            this.handleConnection(conn, username);
            resolve();
          });

          conn.on('error', (err) => {
            clearTimeout(timeout);
            console.error("DataConnection error:", err);
            reject(err);
          });
          
          conn.on('close', () => {
             console.log("DataConnection closed immediately");
          });
          
          // If the peer object itself errors out during connection (e.g. peer not found)
          const peerErrorListener = (err: any) => {
             if (err.type === 'peer-unavailable') {
                 clearTimeout(timeout);
                 reject(new Error("Room code not found."));
             }
          };
          
          this.peer?.once('error', peerErrorListener);
          
          // Cleanup listener if successful
          conn.once('open', () => {
              this.peer?.off('error', peerErrorListener);
          });
        });
    } catch (e) {
        return Promise.reject(e);
    }
  }

  private handleConnection(conn: DataConnection, myUsername: string) {
    this.conn = conn;
    
    if (conn.metadata && conn.metadata.username) {
        this.opponentName = conn.metadata.username;
    }

    // If I am host, send a handshake immediately to confirm connection
    if (this.isHost) {
        setTimeout(() => {
             if (this.conn?.open) {
                this.conn.send({ type: 'HANDSHAKE', payload: { username: myUsername } });
             }
        }, 500);
    }

    conn.on('data', (data: any) => {
      const msg = data as P2PMessage;
      console.log("Received P2P Message:", msg.type);
      
      if (msg.type === 'HANDSHAKE' && !this.isHost) {
        this.opponentName = msg.payload.username;
        console.log("Opponent identified as:", this.opponentName);
      }
      
      this.messageHandlers.forEach(handler => handler(msg));
    });

    conn.on('close', () => {
      console.log("DataConnection closed");
      this.conn = null;
    });
    
    conn.on('error', (err) => {
        console.error("DataConnection error:", err);
    });
  }

  public send(type: any, payload: any) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type, payload });
    } else {
        console.warn("P2P: Cannot send message, connection not open.");
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
    this.myId = '';
    this.isHost = false;
  }
}

// Singleton instance
export const p2pManager = new P2PService();