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
    this.myId = Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  public init(username: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a random ID for this session
      this.peer = new Peer(this.myId, {
        debug: 2
      });

      this.peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        this.myId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn, username);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  public connect(hostId: string, username: string): Promise<void> {
    if (!this.peer) return Promise.reject("Peer not initialized");
    this.isHost = false;
    const conn = this.peer.connect(hostId, {
      metadata: { username }
    });
    return new Promise((resolve) => {
      conn.on('open', () => {
        this.handleConnection(conn, username);
        resolve();
      });
    });
  }

  private handleConnection(conn: DataConnection, myUsername: string) {
    this.conn = conn;
    
    // If I received a connection, the other person's username is in metadata
    if (conn.metadata && conn.metadata.username) {
        this.opponentName = conn.metadata.username;
    }

    // Send my details back if I accepted a connection
    if (this.isHost) {
        conn.send({ type: 'HANDSHAKE', payload: { username: myUsername } });
    }

    conn.on('data', (data: any) => {
      const msg = data as P2PMessage;
      if (msg.type === 'HANDSHAKE' && !this.isHost) {
        this.opponentName = msg.payload.username;
      }
      this.messageHandlers.forEach(handler => handler(msg));
    });

    conn.on('close', () => {
      console.log("Connection closed");
      this.conn = null;
    });
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
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

// Singleton instance
export const p2pManager = new P2PService();
