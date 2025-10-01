import type { GameAction } from '@pwyf/shared';
import type { HandState, PlayerState, RoomState } from '../game/types';

export interface PersistenceAdapter {
  init(): Promise<void>;
  createRoom(room: RoomState): Promise<void>;
  updateRoomLock(roomCode: string, locked: boolean): Promise<void>;
  upsertPlayer(roomCode: string, player: PlayerState): Promise<void>;
  updatePlayerConnection(roomCode: string, playerId: string, connected: boolean): Promise<void>;
  recordHand(roomCode: string, hand: HandState): Promise<void>;
  recordAction(roomCode: string, handNumber: number, action: GameAction): Promise<void>;
}

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  async init(): Promise<void> {}
  async createRoom(): Promise<void> {}
  async updateRoomLock(): Promise<void> {}
  async upsertPlayer(): Promise<void> {}
  async updatePlayerConnection(): Promise<void> {}
  async recordHand(): Promise<void> {}
  async recordAction(): Promise<void> {}
}
