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

  private generateId(): string {
    // 5 chars mostly upper case
    return Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  public init(username: string): Promise<string> {
    this.destroy(); // Ensure clean state

    return new Promise((resolve, reject) => {
      let isResolved = false;

      // 1. Set a timeout to prevent hanging forever
      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
            isResolved = true;
            this.destroy();
            console.error("PeerJS: Init timed out");
            reject(new Error("Connection timed out. Please try again."));
        }
      }, 10000); // 10 seconds

      try {
          this.myId = this.generateId();
          this.peer = new Peer(this.myId, {
            debug: 1, // Errors only
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
          });
      } catch (e) {
          isResolved = true;
          clearTimeout(timeoutTimer);
          reject(e);
          return;
      }

      this.peer.on('open', (id) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutTimer);
        console.log('PeerJS: ID is ' + id);
        this.myId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn, username);
      });

      this.peer.on('disconnected', () => {
        console.warn('PeerJS: Disconnected from server.');
        // If we are in the middle of init, let's try to reconnect immediately
        if (!isResolved) {
             this.peer?.reconnect();
             return;
        }
        // Otherwise attempt auto-reconnect
        if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
        }
      });

      this.peer.on('close', () => {
        console.log('PeerJS: Connection closed.');
        this.conn = null;
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        // Fail init if error occurs before open
        if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutTimer);
            reject(err);
        }
      });
    });
  }

  public connect(hostId: string, username: string): Promise<void> {
    if (!this.peer || this.peer.destroyed) {
         return this.init(username).then(() => this.connect(hostId, username));
    }

    this.isHost = false;
    if (this.conn) {
        this.conn.close();
    }

    // Connect to host
    try {
        const conn = this.peer.connect(hostId, {
          metadata: { username },
          reliable: true
        });

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
              reject(new Error("Connection to host timed out"));
          }, 10000);

          conn.on('open', () => {
            clearTimeout(timeout);
            this.handleConnection(conn, username);
            resolve();
          });

          conn.on('error', (err) => {
            clearTimeout(timeout);
            console.error("DataConnection error:", err);
            reject(err);
          });
          
          // If peer fails while connecting
          const peerErrorHandler = (err: any) => {
               clearTimeout(timeout);
               reject(err);
          };
          
          this.peer?.once('error', peerErrorHandler);
          
          // Cleanup listener
          conn.once('open', () => {
              this.peer?.off('error', peerErrorHandler);
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

    if (this.isHost) {
        setTimeout(() => {
             if (this.conn?.open) {
                this.conn.send({ type: 'HANDSHAKE', payload: { username: myUsername } });
             }
        }, 500);
    }

    conn.on('data', (data: any) => {
      const msg = data as P2PMessage;
      if (msg.type === 'HANDSHAKE' && !this.isHost) {
        this.opponentName = msg.payload.username;
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
  }
}

// Singleton instance
export const p2pManager = new P2PService();