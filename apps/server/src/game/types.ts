import type {
  Card,
  ChatMessage,
  DeckCommitment,
  GameAction,
  GamePhase,
  HandSummary,
  PlayerStatus,
  PlayerView,
  Pot,
} from '@pwyf/shared';
import type { CommittedDeck, SecretCard } from './commitment';

export interface PlayerState {
  id: string;
  token: string;
  name: string;
  seat: number | null;
  stack: number;
  isHost: boolean;
  connected: boolean;
  status: PlayerStatus;
  bet: number;
  totalBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  holeCards: Card[];
  holeSecretPositions: number[];
  lastActionAt: number;
  hasActed: boolean;
}

export interface HandState {
  handNumber: number;
  deck: Card[];
  deckPosition: number;
  secrets: SecretCard[];
  commitment: DeckCommitment & { masterSalt: string };
  board: Card[];
  boardSecretPositions: number[];
  phase: GamePhase;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentSeat: number | null;
  currentBet: number;
  minimumRaise: number | null;
  pot: number;
  pots: Pot[];
  actions: GameAction[];
  startedAt: number;
  endedAt?: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  createdAt: number;
  isLocked: boolean;
  players: PlayerState[];
  hand?: HandState;
  chat: ChatMessage[];
  lastCommittedDeck?: CommittedDeck;
  handHistory: GameAction[];
  handCounter: number;
  lastSummary?: HandSummary;
  nextHandAt?: number;
  nextHandTimer?: NodeJS.Timeout;
}

export interface PlayerAuth {
  playerId: string;
  token: string;
  roomCode: string;
}

export interface SerializedState {
  snapshot: {
    code: string;
    hostId: string;
    isLocked: boolean;
    createdAt: number;
    players: PlayerView[];
    phase: GamePhase;
    board: Card[];
    pot: number;
    pots: Pot[];
    currentSeat: number | null;
    smallBlind: number;
    bigBlind: number;
    minimumRaise: number | null;
    actionTimer?: number;
    handNumber: number;
    deckCommitment?: DeckCommitment;
    holeCards?: { playerId: string; cards: Card[] }[];
    pendingActions: GameAction[];
  };
}

