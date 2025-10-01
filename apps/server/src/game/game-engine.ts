import { randomUUID } from 'node:crypto';
import type { ActionPayload, GameAction, HandSummary, Pot } from '@pwyf/shared';
import { evaluateCards } from '@pwyf/shared';
import { BIG_BLIND, MIN_PLAYERS, SMALL_BLIND } from './constants';
import {
  activePlayersInHand,
  findPlayerById,
  getOrderedSeats,
  nextSeatFrom,
  resetBets,
  resetPlayersForNewHand,
  seatedPlayers,
} from './utils';
import type { HandState, PlayerState, RoomState } from './types';
import { generateCommittedDeck } from './commitment';
import type { PersistenceAdapter } from '../store/persistence';

export class GameEngine {
  constructor(private readonly persistence: PersistenceAdapter) {}

  startHand(room: RoomState): HandState {
    const seated = seatedPlayers(room).filter((player) => player.stack > 0);
    if (seated.length < MIN_PLAYERS) {
      throw new Error('Need at least two players to start a hand');
    }

    resetPlayersForNewHand(room);

    const committedDeck = generateCommittedDeck();
    room.lastCommittedDeck = committedDeck;

    const orderedSeats = getOrderedSeats(room);
    const previousDealer = room.hand?.dealerSeat ?? orderedSeats[0];
    const dealerSeat = nextSeatFrom(room, previousDealer ?? null) ?? orderedSeats[0];
    const smallBlindSeat = nextSeatFrom(room, dealerSeat) ?? dealerSeat;
    const bigBlindSeat = nextSeatFrom(room, smallBlindSeat) ?? smallBlindSeat;

    const handNumber = room.handCounter + 1;
    const hand: HandState = {
      handNumber,
      deck: [...committedDeck.deck],
      deckPosition: 0,
      secrets: committedDeck.secrets,
      commitment: committedDeck.commitment,
      board: [],
      boardSecretPositions: [],
      phase: 'preflop',
      dealerSeat,
      smallBlindSeat,
      bigBlindSeat,
      currentSeat: null,
      currentBet: BIG_BLIND,
      minimumRaise: BIG_BLIND,
      pot: 0,
      pots: [],
      actions: [],
      startedAt: Date.now(),
    };

    room.handCounter = handNumber;
    room.hand = hand;
    room.lastSummary = undefined;

    this.postBlind(room, hand, smallBlindSeat, SMALL_BLIND);
    this.postBlind(room, hand, bigBlindSeat, BIG_BLIND);
    this.dealHoleCards(room, hand);

    const nextSeat = this.findNextActingSeat(room, hand, bigBlindSeat);
    hand.currentSeat = nextSeat;
    if (nextSeat !== null) {
      this.markActingSeat(room, nextSeat);
    }

    return hand;
  }

  handleAction(room: RoomState, playerId: string, payload: ActionPayload): HandSummary | null {
    const hand = room.hand;
    if (!hand) {
      throw new Error('No active hand');
    }

    const player = findPlayerById(room, playerId);
    if (!player) {
      throw new Error('Unknown player');
    }
    if (player.seat !== hand.currentSeat) {
      throw new Error('It is not your turn');
    }
    if (player.hasFolded || player.isAllIn || player.status === 'out') {
      throw new Error('Player cannot act');
    }

    let loggedAmount: number | undefined = payload.amount;
    const previousBet = player.bet;

    switch (payload.type) {
      case 'fold':
        this.onFold(player);
        loggedAmount = undefined;
        break;
      case 'check':
        this.onCheck(player, hand);
        loggedAmount = undefined;
        break;
      case 'call':
        this.onCall(player, hand);
        loggedAmount = player.bet - previousBet;
        break;
      case 'bet':
      case 'raise':
        this.onBetOrRaise(room, player, hand, payload);
        loggedAmount = payload.amount;
        break;
      default:
        throw new Error('Unsupported action');
    }

    player.hasActed = true;
    player.lastActionAt = Date.now();

    const action: GameAction = {
      id: randomUUID(),
      playerId: player.id,
      type: payload.type,
      amount: loggedAmount,
      createdAt: player.lastActionAt,
      round: hand.phase,
    };

    hand.actions.push(action);
    room.handHistory.push(action);
    void this.persistence.recordAction(room.code, hand.handNumber, action);

    const summary = this.tryResolve(room, hand);
    if (summary) {
      return summary;
    }

    this.advanceTurn(room, hand);
    return null;
  }

  private onFold(player: PlayerState): void {
    player.hasFolded = true;
    player.status = 'folded';
  }

  private onCheck(player: PlayerState, hand: HandState): void {
    if (player.bet !== hand.currentBet) {
      throw new Error('Cannot check while facing a bet');
    }
    player.status = 'waiting';
  }

  private onCall(player: PlayerState, hand: HandState): void {
    const owed = hand.currentBet - player.bet;
    if (owed <= 0) {
      throw new Error('Nothing to call');
    }
    const chips = Math.min(player.stack, owed);
    player.stack -= chips;
    player.bet += chips;
    player.totalBet += chips;
    hand.pot += chips;
    player.status = player.stack === 0 ? 'all-in' : 'waiting';
    if (player.stack === 0) {
      player.isAllIn = true;
    }
  }

  private onBetOrRaise(
    room: RoomState,
    player: PlayerState,
    hand: HandState,
    payload: ActionPayload,
  ): void {
    if (payload.amount === undefined || payload.amount <= hand.currentBet) {
      throw new Error('Bet/Raise must exceed current bet');
    }

    const targetBet = payload.amount;
    const additional = targetBet - player.bet;
    if (additional > player.stack) {
      throw new Error('Insufficient chips');
    }

    const raiseAmount = targetBet - hand.currentBet;
    if (hand.currentBet > 0 && raiseAmount < (hand.minimumRaise ?? BIG_BLIND)) {
      throw new Error('Raise below minimum');
    }

    player.stack -= additional;
    player.bet = targetBet;
    player.totalBet += additional;
    hand.pot += additional;

    hand.currentBet = targetBet;
    hand.minimumRaise = raiseAmount || BIG_BLIND;

    player.status = player.stack === 0 ? 'all-in' : 'waiting';
    if (player.stack === 0) {
      player.isAllIn = true;
    }

    room.players.forEach((other) => {
      if (other.id !== player.id && !other.hasFolded && !other.isAllIn && other.status !== 'out') {
        other.hasActed = false;
      }
    });
  }

  private postBlind(room: RoomState, hand: HandState, seat: number, blind: number): void {
    const player = room.players.find((p) => p.seat === seat);
    if (!player) {
      return;
    }
    const contribution = Math.min(player.stack, blind);
    player.stack -= contribution;
    player.bet += contribution;
    player.totalBet += contribution;
    hand.pot += contribution;
    if (player.stack === 0) {
      player.isAllIn = true;
      player.status = 'all-in';
    }
  }

  private dealHoleCards(room: RoomState, hand: HandState): void {
    const seats = getOrderedSeats(room);
    for (let round = 0; round < 2; round += 1) {
      for (const seat of seats) {
        const player = room.players.find((p) => p.seat === seat);
        if (!player) {
          continue;
        }
        const secret = hand.secrets[hand.deckPosition];
        if (!secret) {
          throw new Error('Deck exhausted while dealing');
        }
        player.holeCards.push(secret.card);
        player.holeSecretPositions.push(secret.position);
        hand.deckPosition += 1;
      }
    }
  }

  private markActingSeat(room: RoomState, seat: number): void {
    room.players.forEach((player) => {
      if (player.seat === seat) {
        player.status = 'acting';
      } else if (!player.hasFolded && !player.isAllIn && player.status !== 'out') {
        player.status = 'waiting';
      }
    });
  }

  private advanceTurn(room: RoomState, hand: HandState): void {
    const nextSeat = this.findNextActingSeat(room, hand, hand.currentSeat ?? hand.dealerSeat);
    if (nextSeat === null) {
      return;
    }
    hand.currentSeat = nextSeat;
    this.markActingSeat(room, nextSeat);
  }

  private findNextActingSeat(room: RoomState, hand: HandState, fromSeat: number | null): number | null {
    const seats = getOrderedSeats(room);
    if (!seats.length) {
      return null;
    }
    const startIndex = fromSeat !== null ? seats.findIndex((seat) => seat === fromSeat) : -1;
    for (let offset = 1; offset <= seats.length; offset += 1) {
      const index = startIndex >= 0 ? (startIndex + offset) % seats.length : (offset - 1) % seats.length;
      const seat = seats[index];
      const candidate = room.players.find((p) => p.seat === seat);
      if (!candidate) {
        continue;
      }
      if (candidate.hasFolded || candidate.isAllIn || candidate.status === 'out') {
        continue;
      }
      if (candidate.bet === hand.currentBet && candidate.hasActed) {
        continue;
      }
      return seat;
    }
    return null;
  }

  private tryResolve(room: RoomState, hand: HandState): HandSummary | null {
    const active = activePlayersInHand(room).filter((player) => !player.hasFolded);
    if (active.length === 1) {
      return this.resolveSingleWinner(room, hand, active[0]);
    }

    const actionablePlayers = active.filter((player) => !player.isAllIn && player.stack > 0);
    const pendingAction = actionablePlayers.some((player) => !player.hasActed);
    const unmatchedBets = actionablePlayers.some((player) => player.bet !== hand.currentBet);

    if (!pendingAction && !unmatchedBets) {
      return this.advancePhase(room, hand);
    }

    return null;
  }

  private advancePhase(room: RoomState, hand: HandState): HandSummary | null {
    const nextPhase = this.nextPhase(hand.phase);
    if (nextPhase === 'complete') {
      return this.resolveShowdown(room, hand);
    }

    if (nextPhase === 'showdown') {
      return this.resolveShowdown(room, hand);
    }

    resetBets(room);
    hand.currentBet = 0;
    hand.minimumRaise = BIG_BLIND;
    hand.phase = nextPhase;

    if (nextPhase === 'flop') {
      this.burnCard(hand);
      this.dealBoard(hand, 3);
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      this.burnCard(hand);
      this.dealBoard(hand, 1);
    }

    const nextSeat = this.findNextActingSeat(room, hand, hand.dealerSeat);
    hand.currentSeat = nextSeat;
    if (nextSeat !== null) {
      this.markActingSeat(room, nextSeat);
    } else {
      hand.currentSeat = null;
    }

    return null;
  }

  private nextPhase(current: HandState['phase']): HandState['phase'] {
    switch (current) {
      case 'preflop':
        return 'flop';
      case 'flop':
        return 'turn';
      case 'turn':
        return 'river';
      case 'river':
        return 'showdown';
      default:
        return 'complete';
    }
  }

  private burnCard(hand: HandState): void {
    hand.deckPosition += 1;
  }

  private dealBoard(hand: HandState, amount: number): void {
    for (let i = 0; i < amount; i += 1) {
      const secret = hand.secrets[hand.deckPosition];
      if (!secret) {
        throw new Error('Deck exhausted while revealing board');
      }
      hand.board.push(secret.card);
      hand.boardSecretPositions.push(secret.position);
      hand.deckPosition += 1;
    }
  }

  private resolveSingleWinner(room: RoomState, hand: HandState, winner: PlayerState): HandSummary {
    const potAmount = hand.pot;
    winner.stack += potAmount;
    hand.pots = [
      {
        amount: potAmount,
        eligiblePlayerIds: [winner.id],
      },
    ];
    hand.pot = 0;
    hand.currentSeat = null;
    hand.phase = 'complete';
    hand.endedAt = Date.now();

    room.players.forEach((player) => {
      if (player.id !== winner.id && !player.hasFolded && player.status !== 'out') {
        player.status = 'waiting';
      }
    });

    return {
      handNumber: hand.handNumber,
      winners: [
        {
          playerId: winner.id,
          amount: potAmount,
          bestHand: {
            rankClass: 'high-card',
            strength: 0,
            tieBreakers: [],
            bestFive: [],
            description: 'Won by fold',
          },
        },
      ],
      board: [...hand.board],
      actions: [...hand.actions],
      startedAt: hand.startedAt,
      endedAt: hand.endedAt,
    };
  }

  private resolveShowdown(room: RoomState, hand: HandState): HandSummary {
    const contenders = room.players.filter((player) => !player.hasFolded && player.holeCards.length === 2);
    const evaluations = contenders.map((player) => ({
      player,
      eval: evaluateCards([...player.holeCards, ...hand.board]),
    }));

    const pots = this.buildPots(room);
    const payouts = new Map<string, number>();

    for (const pot of pots) {
      const eligible = evaluations.filter((entry) => pot.eligiblePlayerIds.includes(entry.player.id));
      if (!eligible.length) {
        continue;
      }
      const best = Math.max(...eligible.map((entry) => entry.eval.strength));
      const winners = eligible.filter((entry) => entry.eval.strength === best);
      const baseShare = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;
      winners
        .sort((a, b) => (a.player.seat ?? 0) - (b.player.seat ?? 0))
        .forEach((entry) => {
          let payout = baseShare;
          if (remainder > 0) {
            payout += 1;
            remainder -= 1;
          }
          entry.player.stack += payout;
          payouts.set(entry.player.id, (payouts.get(entry.player.id) ?? 0) + payout);
        });
    }

    hand.pots = pots;
    hand.pot = 0;
    hand.currentSeat = null;
    hand.phase = 'complete';
    hand.endedAt = Date.now();

    room.players.forEach((player) => {
      if (player.status !== 'out') {
        player.status = player.hasFolded ? 'folded' : 'waiting';
      }
    });

    return {
      handNumber: hand.handNumber,
      winners: evaluations
        .filter((entry) => payouts.has(entry.player.id))
        .map((entry) => ({
          playerId: entry.player.id,
          amount: payouts.get(entry.player.id) ?? 0,
          bestHand: entry.eval,
        })),
      board: [...hand.board],
      actions: [...hand.actions],
      startedAt: hand.startedAt,
      endedAt: hand.endedAt,
    };
  }

  private buildPots(room: RoomState): Pot[] {
    const contributors = room.players
      .filter((player) => player.totalBet > 0)
      .map((player) => ({
        playerId: player.id,
        remaining: player.totalBet,
        eligible: !player.hasFolded,
      }));

    const pots: Pot[] = [];

    while (contributors.some((entry) => entry.remaining > 0)) {
      const active = contributors.filter((entry) => entry.remaining > 0);
      if (!active.length) break;
      const min = Math.min(...active.map((entry) => entry.remaining));
      const amount = active.reduce((sum, entry) => sum + min, 0);
      const eligible = active
        .filter((entry) => entry.eligible)
        .map((entry) => entry.playerId);
      pots.push({ amount, eligiblePlayerIds: eligible });
      active.forEach((entry) => {
        entry.remaining -= min;
      });
    }

    return pots;
  }
}


