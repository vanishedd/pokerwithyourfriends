import { BIG_BLIND, SMALL_BLIND } from './constants';
import type { PlayerState, RoomState } from './types';
import type { PlayerView, RoomSnapshot } from '@pwyf/shared';

export function playerToView(player: PlayerState): PlayerView {
  return {
    id: player.id,
    name: player.name,
    stack: player.stack,
    seat: player.seat,
    isHost: player.isHost,
    connected: player.connected,
    status: player.status,
    bet: player.bet,
    totalBet: player.totalBet,
    hasFolded: player.hasFolded,
    isAllIn: player.isAllIn,
  };
}

export function sortPlayersForView(players: PlayerState[]): PlayerView[] {
  return players
    .map(playerToView)
    .sort((a, b) => {
      if (a.seat === null && b.seat === null) return a.name.localeCompare(b.name);
      if (a.seat === null) return 1;
      if (b.seat === null) return -1;
      return a.seat - b.seat;
    });
}

export function buildSnapshot(room: RoomState, viewer?: PlayerState): RoomSnapshot {
  const hand = room.hand;
  const phase = hand?.phase ?? 'lobby';
  const deckCommitment = hand
    ? {
        algorithm: hand.commitment.algorithm,
        deckHash: hand.commitment.deckHash,
        hashedCards: hand.commitment.hashedCards,
      }
    : undefined;

  return {
    code: room.code,
    hostId: room.hostId,
    isLocked: room.isLocked,
    createdAt: room.createdAt,
    players: sortPlayersForView(room.players),
    phase,
    board: hand?.board ?? [],
    pot: hand?.pot ?? 0,
    pots: hand?.pots ?? [],
    currentSeat: hand?.currentSeat ?? null,
    dealerSeat: hand?.dealerSeat ?? null,
    smallBlindSeat: hand?.smallBlindSeat ?? null,
    bigBlindSeat: hand?.bigBlindSeat ?? null,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    currentBet: hand?.currentBet ?? 0,
    minimumRaise: hand?.minimumRaise ?? null,
    actionTimer: undefined,
    handNumber: hand?.handNumber ?? room.handCounter,
    deckCommitment,
    holeCards:
      viewer && hand && viewer.holeCards.length
        ? [
            {
              playerId: viewer.id,
              cards: viewer.holeCards,
            },
          ]
        : undefined,
    pendingActions: hand?.actions ?? [],
    chat: room.chat,
    lastSummary: room.lastSummary,
    nextHandAt: room.nextHandAt,
  };
}

export function findPlayerByToken(room: RoomState, token: string): PlayerState | undefined {
  return room.players.find((player) => player.token === token);
}

export function findPlayerById(room: RoomState, playerId: string): PlayerState | undefined {
  return room.players.find((player) => player.id === playerId);
}

export function seatedPlayers(room: RoomState): PlayerState[] {
  return room.players.filter((player) => player.seat !== null);
}

export function assignNextSeat(room: RoomState, player: PlayerState): number {
  const seats = getOrderedSeats(room);
  for (let seat = 0; seat < 6; seat += 1) {
    if (!seats.includes(seat)) {
      player.seat = seat;
      return seat;
    }
  }
  const nextSeat = seats.length;
  player.seat = nextSeat;
  return nextSeat;
}

export function getOrderedSeats(room: RoomState): number[] {
  return room.players
    .map((player) => player.seat)
    .filter((seat): seat is number => seat !== null)
    .sort((a, b) => a - b);
}

export function resetPlayersForNewHand(room: RoomState): void {
  room.players.forEach((player) => {
    player.bet = 0;
    player.totalBet = 0;
    player.hasFolded = false;
    player.isAllIn = false;
    player.holeCards = [];
    player.holeSecretPositions = [];
    player.status = player.stack > 0 ? 'waiting' : 'out';
    player.hasActed = false;
  });
}

export function resetBets(room: RoomState): void {
  room.players.forEach((player) => {
    player.bet = 0;
    player.hasActed = false;
    if (!player.hasFolded && !player.isAllIn && player.stack > 0) {
      player.status = 'waiting';
    }
  });
}

export function activePlayersInHand(room: RoomState): PlayerState[] {
  return room.players.filter((player) => player.status !== 'out');
}

export function nextSeatFrom(room: RoomState, startSeat: number | null): number | null {
  const ordered = getOrderedSeats(room);
  if (!ordered.length) {
    return null;
  }
  if (startSeat === null) {
    return ordered[0];
  }
  const sorted = ordered.sort((a, b) => a - b);
  const candidates = sorted.filter((seat) => seat > startSeat);
  if (candidates.length) {
    return candidates[0];
  }
  return sorted[0] ?? null;
}

export function requirePlayer(player: PlayerState | undefined, message: string): PlayerState {
  if (!player) {
    throw new Error(message);
  }
  return player;
}








