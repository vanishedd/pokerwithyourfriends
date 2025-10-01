import { randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import type {
  ActionPayload,
  ClientToServerEvents,
  HandSummary,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@pwyf/shared';
import { DEFAULT_STACK, MAX_PLAYERS, MIN_PLAYERS } from './constants';
import {
  assignNextSeat,
  buildSnapshot,
  findPlayerByToken,
  requirePlayer,
  seatedPlayers,
} from './utils';
import type { PlayerState, RoomState } from './types';
import type { GameEngine } from './game-engine';
import type { PersistenceAdapter } from '../store/persistence';

const NAME_COLLISION_MESSAGE = 'A player with that name already joined this room';
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NEXT_HAND_DELAY_MS = 15_000;

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[index];
  }
  return code;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();

  private readonly tokens = new Map<string, { roomCode: string; playerId: string }>();

  private readonly socketIndex = new Map<string, Set<GameSocket>>();

  private namespace?: GameNamespace;

  constructor(
    private readonly persistence: PersistenceAdapter,
    private readonly engine: GameEngine,
  ) {}

  attachNamespace(namespace: GameNamespace): void {
    this.namespace = namespace;
    namespace.on('connection', (socket) => this.handleConnection(socket));
  }

  async createRoom(hostName: string, stack: number = DEFAULT_STACK): Promise<{
    roomCode: string;
    playerToken: string;
    playerId: string;
  }> {
    const code = this.generateUniqueCode();
    const player: PlayerState = {
      id: randomUUID(),
      token: randomUUID(),
      name: hostName,
      seat: 0,
      stack,
      isHost: true,
      connected: false,
      status: 'waiting',
      bet: 0,
      totalBet: 0,
      hasFolded: false,
      isAllIn: false,
      holeCards: [],
      holeSecretPositions: [],
      lastActionAt: Date.now(),
      hasActed: false,
    };

    const room: RoomState = {
      code,
      hostId: player.id,
      createdAt: Date.now(),
      isLocked: false,
      players: [player],
      chat: [],
      handHistory: [],
      handCounter: 0,
    };

    this.rooms.set(code, room);
    this.tokens.set(player.token, { roomCode: code, playerId: player.id });

    await this.persistence.createRoom(room);
    await this.persistence.upsertPlayer(code, player);

    return { roomCode: code, playerToken: player.token, playerId: player.id };
  }

  async joinRoom(code: string, name: string): Promise<{ token: string; playerId: string }> {
    const room = this.requireRoom(code);
    if (room.isLocked) {
      throw new Error('Room is locked');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }
    if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(NAME_COLLISION_MESSAGE);
    }

    const player: PlayerState = {
      id: randomUUID(),
      token: randomUUID(),
      name,
      seat: null,
      stack: DEFAULT_STACK,
      isHost: false,
      connected: false,
      status: 'waiting',
      bet: 0,
      totalBet: 0,
      hasFolded: false,
      isAllIn: false,
      holeCards: [],
      holeSecretPositions: [],
      lastActionAt: Date.now(),
      hasActed: false,
    };

    assignNextSeat(room, player);
    room.players.push(player);
    this.tokens.set(player.token, { roomCode: code, playerId: player.id });

    await this.persistence.upsertPlayer(code, player);
    await this.broadcastRoom(room);

    return { token: player.token, playerId: player.id };
  }

  async toggleLock(code: string, token: string, locked: boolean): Promise<void> {
    const room = this.requireRoom(code);
    const player = this.requirePlayerByToken(room, token);
    if (!player.isHost) {
      throw new Error('Only the host can lock the room');
    }
    room.isLocked = locked;
    await this.persistence.updateRoomLock(code, locked);
    await this.broadcastRoom(room);
  }

  async startHand(code: string, token: string): Promise<void> {
    const room = this.requireRoom(code);
    const player = this.requirePlayerByToken(room, token);
    if (!player.isHost) {
      throw new Error('Only the host can start the hand');
    }
    this.clearScheduledHand(room);
    if (room.hand && room.hand.phase !== 'complete') {
      throw new Error('Hand already in progress');
    }

    this.beginHand(room);
  }

  getSnapshot(code: string, token: string) {
    const room = this.requireRoom(code);
    const player = this.requirePlayerByToken(room, token);
    return buildSnapshot(room, player);
  }

  private beginHand(room: RoomState): void {
    const hand = this.engine.startHand(room);
    room.nextHandAt = undefined;
    this.emitCommitment(room);
    this.emitHoleCards(room);
    void this.broadcastRoom(room);
  }

  private handleConnection(socket: GameSocket): void {
    let credentials;
    try {
      credentials = this.resolveHandshake(socket);
    } catch (error) {
      socket.emit('room:error', { message: error instanceof Error ? error.message : 'Authentication failed' });
      socket.disconnect(true);
      return;
    }

    const { token, roomCode } = credentials;
    const auth = this.tokens.get(token);
    if (!auth || auth.roomCode !== roomCode) {
      socket.emit('room:error', { message: 'Invalid session token' });
      socket.disconnect(true);
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      socket.disconnect(true);
      return;
    }

    const player = room.players.find((entry) => entry.id === auth.playerId);
    if (!player) {
      socket.emit('room:error', { message: 'Player not found' });
      socket.disconnect(true);
      return;
    }

    socket.data.roomCode = roomCode;
    socket.data.playerId = player.id;
    socket.data.playerToken = token;
    socket.join(roomCode);

    this.trackSocket(token, socket);

    player.connected = true;
    if (player.status === 'disconnected') {
      player.status = 'waiting';
    }

    void this.persistence.updatePlayerConnection(room.code, token, true);

    socket.on('player:action', (payload) => this.handlePlayerAction(socket, payload));
    socket.on('chat:message', (message) => this.handleChat(socket, message));
    socket.on('request:state', () => this.sendSnapshotToSocket(room, player, socket));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    this.sendSnapshotToSocket(room, player, socket);
    this.emitPersonalHoleCards(room, player, socket);
  }

  private handlePlayerAction(socket: GameSocket, payload: ActionPayload): void {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return;
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    const previousBoardCount = room.hand?.board.length ?? 0;

    try {
      const summary = this.engine.handleAction(room, playerId, payload);
      this.emitBoardUpdates(room, previousBoardCount);
      if (summary) {
        this.onHandComplete(room, summary);
      } else {
        void this.broadcastRoom(room);
      }
    } catch (error) {
      socket.emit('room:error', { message: error instanceof Error ? error.message : 'Action failed' });
    }
  }

  private handleChat(socket: GameSocket, message: string): void {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return;
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    const chatEntry = {
      id: randomUUID(),
      playerId: player.id,
      name: player.name,
      message: trimmed.slice(0, 280),
      createdAt: Date.now(),
    };

    room.chat.push(chatEntry);
    if (room.chat.length > 50) {
      room.chat.shift();
    }

    this.namespace?.to(room.code).emit('chat:message', chatEntry);
  }

  private handleDisconnect(socket: GameSocket): void {
    const { playerToken, roomCode, playerId } = socket.data;
    if (!playerToken || !roomCode || !playerId) {
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    this.untrackSocket(playerToken, socket);

    const stillConnected = this.socketIndex.get(playerToken)?.size ?? 0;
    if (stillConnected === 0) {
      player.connected = false;
      if (player.status !== 'out') {
        player.status = 'disconnected';
      }
      void this.persistence.updatePlayerConnection(room.code, playerToken, false);
      void this.broadcastRoom(room);
    }
  }

  private onHandComplete(room: RoomState, summary: HandSummary): void {
    room.lastSummary = summary;
    room.nextHandAt = Date.now() + NEXT_HAND_DELAY_MS;
    if (room.hand) {
      void this.persistence.recordHand(room.code, room.hand);
    }

    this.namespace?.to(room.code).emit('hand:complete', summary);
    this.emitCommitment(room, true);
    void this.broadcastRoom(room);
    this.scheduleNextHand(room);
  }

  private scheduleNextHand(room: RoomState): void {
    if (room.nextHandTimer) {
      clearTimeout(room.nextHandTimer);
    }
    room.nextHandTimer = setTimeout(() => this.tryStartNextHand(room.code), NEXT_HAND_DELAY_MS);
  }

  private clearScheduledHand(room: RoomState): void {
    if (room.nextHandTimer) {
      clearTimeout(room.nextHandTimer);
      room.nextHandTimer = undefined;
    }
    room.nextHandAt = undefined;
  }

  private tryStartNextHand(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    room.nextHandTimer = undefined;

    if (room.hand && room.hand.phase !== 'complete') {
      return;
    }

    const eligible = seatedPlayers(room).filter((player) => player.stack > 0).length;
    if (eligible < MIN_PLAYERS) {
      room.nextHandAt = undefined;
      void this.broadcastRoom(room);
      return;
    }

    try {
      this.beginHand(room);
    } catch (error) {
      room.nextHandAt = undefined;
      // eslint-disable-next-line no-console
      console.error('Failed to auto-start hand', error);
    }
  }

  private async broadcastRoom(room: RoomState): Promise<void> {
    if (!this.namespace) {
      return;
    }
    const sockets = await this.namespace.in(room.code).fetchSockets();
    await Promise.all(
      sockets.map(async (socket) => {
        const viewer = room.players.find((player) => player.id === socket.data.playerId);
        socket.emit('room:state', buildSnapshot(room, viewer));
      }),
    );
  }

  private sendSnapshotToSocket(room: RoomState, player: PlayerState, socket: GameSocket): void {
    socket.emit('room:state', buildSnapshot(room, player));
  }

  private emitCommitment(room: RoomState, revealMaster = false): void {
    if (!this.namespace || !room.hand) {
      return;
    }
    const { commitment } = room.hand;
    const payload = revealMaster
      ? commitment
      : {
          algorithm: commitment.algorithm,
          deckHash: commitment.deckHash,
          hashedCards: commitment.hashedCards,
        };
    this.namespace.to(room.code).emit('hand:commitment', payload);
  }

  private emitHoleCards(room: RoomState): void {
    const hand = room.hand;
    if (!hand) {
      return;
    }
    room.players.forEach((player) => {
      const sockets = this.socketIndex.get(player.token);
      if (!sockets || !sockets.size) {
        return;
      }
      const reveals = player.holeSecretPositions
        .map((position) => hand.secrets.find((secret) => secret.position === position))
        .filter((secret): secret is typeof hand.secrets[number] => Boolean(secret));
      if (!reveals.length) {
        return;
      }
      sockets.forEach((sock) => {
        reveals.forEach((secret) => {
          sock.emit('hand:reveal', {
            position: secret.position,
            card: secret.card,
            salt: secret.salt,
            hash: secret.hash,
          });
        });
      });
    });
  }

  private emitPersonalHoleCards(room: RoomState, player: PlayerState, socket: GameSocket): void {
    const hand = room.hand;
    if (!hand || !player.holeSecretPositions.length) {
      return;
    }
    player.holeSecretPositions
      .map((position) => hand.secrets.find((secret) => secret.position === position))
      .filter((secret): secret is typeof hand.secrets[number] => Boolean(secret))
      .forEach((secret) => {
        socket.emit('hand:reveal', {
          position: secret.position,
          card: secret.card,
          salt: secret.salt,
          hash: secret.hash,
        });
      });
  }

  private emitBoardUpdates(room: RoomState, previousCount: number): void {
    const hand = room.hand;
    if (!hand) {
      return;
    }
    if (hand.boardSecretPositions.length <= previousCount) {
      return;
    }
    const newPositions = hand.boardSecretPositions.slice(previousCount);
    newPositions.forEach((position) => {
      const secret = hand.secrets.find((entry) => entry.position === position);
      if (!secret) {
        return;
      }
      this.namespace?.to(room.code).emit('hand:reveal', {
        position: secret.position,
        card: secret.card,
        salt: secret.salt,
        hash: secret.hash,
      });
    });
  }

  private requireRoom(code: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error('Room not found');
    }
    return room;
  }

  private requirePlayerByToken(room: RoomState, token: string): PlayerState {
    const player = findPlayerByToken(room, token);
    return requirePlayer(player, 'Player not part of room');
  }

  private generateUniqueCode(): string {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    return code;
  }

  private resolveHandshake(socket: GameSocket): { token: string; roomCode: string } {
    const token = (socket.handshake.auth?.token ?? socket.handshake.query.token) as string | undefined;
    const roomCode = (socket.handshake.auth?.roomCode ?? socket.handshake.query.roomCode) as string | undefined;
    if (!token || !roomCode) {
      throw new Error('Missing authentication');
    }
    return { token, roomCode };
  }

  private trackSocket(token: string, socket: GameSocket): void {
    let set = this.socketIndex.get(token);
    if (!set) {
      set = new Set();
      this.socketIndex.set(token, set);
    }
    set.add(socket);
  }

  private untrackSocket(token: string, socket: GameSocket): void {
    const set = this.socketIndex.get(token);
    if (!set) {
      return;
    }
    set.delete(socket);
    if (set.size === 0) {
      this.socketIndex.delete(token);
    }
  }
}




