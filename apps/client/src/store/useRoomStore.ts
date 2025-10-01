import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { create } from 'zustand';
import type {
  ActionPayload,
  CardReveal,
  ChatMessage,
  DeckCommitment,
  RoomSnapshot,
} from '@pwyf/shared';
import { verifyReveal } from '@pwyf/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

interface SessionState {
  roomCode: string;
  token: string;
  playerId: string;
}

interface RoomStore {
  status: 'idle' | 'connecting' | 'connected';
  error?: string;
  session?: SessionState;
  snapshot?: RoomSnapshot;
  chat: ChatMessage[];
  commitment?: DeckCommitment & { masterSalt?: string };
  reveals: Record<number, CardReveal>;
  connect: (session: SessionState) => void;
  disconnect: () => void;
  sendAction: (payload: ActionPayload) => void;
  sendChat: (message: string) => void;
  fetchSnapshot: (session: SessionState) => Promise<void>;
  setError: (message?: string) => void;
  reset: () => void;
}

let socketRef: Socket | null = null;

const SESSION_PREFIX = 'pwyf:session';
const SESSION_INDEX_PREFIX = 'pwyf:session-index';
const ACTIVE_SESSION_PREFIX = 'pwyf:active-session';

const sessionEntryKey = (roomCode: string, playerId: string) => `${SESSION_PREFIX}:${roomCode}:${playerId}`;
const sessionIndexKey = (roomCode: string) => `${SESSION_INDEX_PREFIX}:${roomCode}`;
const activeSessionKey = (roomCode: string) => `${ACTIVE_SESSION_PREFIX}:${roomCode}`;

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function persistIndex(roomCode: string, playerIds: string[]) {
  if (playerIds.length) {
    localStorage.setItem(sessionIndexKey(roomCode), JSON.stringify(playerIds));
  } else {
    localStorage.removeItem(sessionIndexKey(roomCode));
  }
}

function markActiveSession(roomCode: string, playerId: string) {
  sessionStorage.setItem(activeSessionKey(roomCode), playerId);
}

function readSession(roomCode: string, playerId: string): SessionState | null {
  const raw = localStorage.getItem(sessionEntryKey(roomCode, playerId));
  return readJson<SessionState>(raw);
}

function upsertIndex(roomCode: string, playerId: string) {
  const existing = readJson<string[]>(localStorage.getItem(sessionIndexKey(roomCode))) ?? [];
  if (!existing.includes(playerId)) {
    existing.push(playerId);
    persistIndex(roomCode, existing);
  }
}

function removeSession(roomCode: string, playerId: string) {
  localStorage.removeItem(sessionEntryKey(roomCode, playerId));
  const existing = readJson<string[]>(localStorage.getItem(sessionIndexKey(roomCode))) ?? [];
  const filtered = existing.filter((id) => id !== playerId);
  persistIndex(roomCode, filtered);
}

export function saveSession(session: SessionState) {
  localStorage.setItem(sessionEntryKey(session.roomCode, session.playerId), JSON.stringify(session));
  upsertIndex(session.roomCode, session.playerId);
  markActiveSession(session.roomCode, session.playerId);
}

export function loadSession(roomCode: string): SessionState | null {
  const activeId = sessionStorage.getItem(activeSessionKey(roomCode));
  if (activeId) {
    const existing = readSession(roomCode, activeId);
    if (existing) {
      return existing;
    }
  }

  const playerIds = readJson<string[]>(localStorage.getItem(sessionIndexKey(roomCode))) ?? [];
  if (playerIds.length === 1) {
    const session = readSession(roomCode, playerIds[0]);
    if (session) {
      markActiveSession(roomCode, session.playerId);
      return session;
    }
  }

  return null;
}

export function clearSession(roomCode: string) {
  const activeId = sessionStorage.getItem(activeSessionKey(roomCode));
  if (!activeId) {
    return;
  }
  sessionStorage.removeItem(activeSessionKey(roomCode));
  removeSession(roomCode, activeId);
}

const useRoomStore = create<RoomStore>((set, get) => ({
  status: 'idle',
  chat: [],
  reveals: {},
  connect: (session) => {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }

    markActiveSession(session.roomCode, session.playerId);
    set({ status: 'connecting', error: undefined, session });

    const socket = io(`${SERVER_URL}/ws`, {
      transports: ['websocket'],
      auth: {
        token: session.token,
        roomCode: session.roomCode,
      },
      withCredentials: true,
    });

    socket.on('connect', () => {
      set({ status: 'connected' });
    });

    socket.on('disconnect', () => {
      set({ status: 'idle' });
    });

    socket.on('room:error', ({ message }) => {
      set({ error: message });
    });

    socket.on('room:state', (snapshot) => {
      set((state) => ({
        snapshot,
        chat: snapshot.chat || state.chat,
      }));
    });

    socket.on('chat:message', (message) => {
      set((state) => ({ chat: [...state.chat.slice(-49), message] }));
    });

    socket.on('hand:commitment', (commitment) => {
      set({ commitment, reveals: {} });
    });

    socket.on('hand:reveal', (reveal) => {
      const { commitment } = get();
      if (commitment && !verifyReveal(reveal, commitment)) {
        console.warn('Reveal failed verification', reveal);
        return;
      }
      set((state) => ({
        reveals: {
          ...state.reveals,
          [reveal.position]: reveal,
        },
      }));
    });

    socketRef = socket;
  },
  disconnect: () => {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }
    set({ status: 'idle' });
  },
  sendAction: (payload) => {
    if (!socketRef) return;
    socketRef.emit('player:action', payload);
  },
  sendChat: (message) => {
    if (!socketRef) return;
    socketRef.emit('chat:message', message);
  },
  fetchSnapshot: async (session) => {
    const response = await axios.get<{ room: RoomSnapshot }>(`${SERVER_URL}/api/rooms/${session.roomCode}`, {
      params: { token: session.token },
    });
    set({ snapshot: response.data.room, chat: response.data.room.chat ?? [] });
  },
  setError: (message) => set({ error: message }),
  reset: () => {
    if (socketRef) {
      socketRef.disconnect();
      socketRef = null;
    }
    set({ status: 'idle', snapshot: undefined, chat: [], commitment: undefined, reveals: {}, session: undefined });
  },
}));

export default useRoomStore;
