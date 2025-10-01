import type { CardReveal, ChatMessage, GameAction, HandSummary, RoomSnapshot } from './types';

export interface ClientActionPayload {
  type: GameAction['type'];
  amount?: number;
}

export interface ClientToServerEvents {
  'player:action': (payload: ClientActionPayload) => void;
  'chat:message': (message: string) => void;
  'request:state': () => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'chat:message': (message: ChatMessage) => void;
  'room:error': (info: { message: string }) => void;
  'hand:commitment': (commitment: RoomSnapshot['deckCommitment']) => void;
  'hand:reveal': (reveal: CardReveal) => void;
  'hand:complete': (summary: HandSummary) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  roomCode?: string;
  playerId?: string;
  playerToken?: string;
}
