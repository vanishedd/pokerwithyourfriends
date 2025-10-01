import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  withCredentials: true,
});

export async function createRoom(payload: { name: string; stack: number }) {
  const response = await api.post('/rooms', payload);
  return response.data as { roomCode: string; playerToken: string; playerId: string };
}

export async function joinRoom(code: string, payload: { name: string }) {
  const response = await api.post(`/rooms/${code}/join`, payload);
  return response.data as { token: string; playerId: string };
}

export async function startHand(code: string, token: string) {
  await api.post(`/rooms/${code}/start`, { token });
}

export async function toggleLock(code: string, token: string, locked: boolean) {
  await api.post(`/rooms/${code}/lock`, { token, locked });
}
