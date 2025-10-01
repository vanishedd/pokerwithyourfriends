export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardCode = `${Rank}${Suit}`;

export type PlayerRole = 'host' | 'player';

export type PlayerStatus =
  | 'waiting'
  | 'acting'
  | 'folded'
  | 'all-in'
  | 'out'
  | 'disconnected';

export type GamePhase =
  | 'lobby'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'complete';

export interface PlayerView {
  id: string;
  name: string;
  stack: number;
  seat: number | null;
  isHost: boolean;
  connected: boolean;
  status: PlayerStatus;
  bet: number;
  totalBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
}

export interface PlayerHoleCards {
  playerId: string;
  cards: Card[];
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface GameAction {
  id: string;
  playerId: string;
  type: ActionType;
  amount?: number;
  createdAt: number;
  round: GamePhase;
}

export interface HandSummary {
  handNumber: number;
  winners: { playerId: string; amount: number; bestHand: EvaluatedHand }[];
  board: Card[];
  actions: GameAction[];
  startedAt: number;
  endedAt: number;
}

export type HandRankClass =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush';

export interface EvaluatedHand {
  rankClass: HandRankClass;
  strength: number;
  tieBreakers: number[];
  bestFive: Card[];
  description: string;
}

export interface DeckCommitment {
  algorithm: 'sha256';
  deckHash: string;
  hashedCards: string[];
}

export interface CardReveal {
  position: number;
  card: Card;
  salt: string;
  hash: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  message: string;
  createdAt: number;
}

export interface RoomSnapshot {
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
  dealerSeat: number | null;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;
  minimumRaise: number | null;
  actionTimer?: number;
  handNumber: number;
  deckCommitment?: DeckCommitment;
  holeCards?: PlayerHoleCards[];
  pendingActions: GameAction[];
  chat: ChatMessage[];
  lastSummary?: HandSummary;
  nextHandAt?: number;
}


