export interface Team {
  id: string;
  name: string;
  colors: [string, string];
  logo?: string;
}

export enum GameState {
  MENU = 'MENU',
  SELECTION = 'SELECTION',
  REVEAL = 'REVEAL',
  PLAYING = 'PLAYING',
  ROUND_END = 'ROUND_END',
  MATCH_END = 'MATCH_END'
}

export interface Player {
  name: string;
  teams: string[];
}

export interface Message {
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
}

export type P2PMessageType = 
  | 'HANDSHAKE' 
  | 'TEAM_SELECT' 
  | 'START_GAME' 
  | 'SCORE_UPDATE' 
  | 'GAME_OVER'
  | 'REMATCH'
  | 'ROUND_TIMEOUT';

export interface P2PMessage {
  type: P2PMessageType;
  payload: any;
}