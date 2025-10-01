import { combinations } from './utils/combinatorics';
import { RANK_VALUES, cardToCode } from './cards';
import type { Card, EvaluatedHand, HandRankClass } from './types';

const HAND_RANK_ORDER: HandRankClass[] = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
];

const BASE = 15; // base used for encoding tie breakers

interface FiveCardEvaluation {
  rankClass: HandRankClass;
  tieBreakers: number[];
  bestFive: Card[];
  description: string;
}

export function evaluateCards(cards: Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('Texas Hold\'em evaluation expects between 5 and 7 cards');
  }
  let best: EvaluatedHand | null = null;
  for (const combo of combinations(cards, 5)) {
    const current = evaluateFiveCardCombo(combo);
    const strength = encodeHandStrength(current.rankClass, current.tieBreakers);
    if (!best || strength > best.strength) {
      best = {
        rankClass: current.rankClass,
        tieBreakers: current.tieBreakers,
        bestFive: combo,
        strength,
        description: current.description,
      };
    }
  }
  if (!best) {
    throw new Error('Failed to evaluate hand');
  }
  return best;
}

function evaluateFiveCardCombo(cards: Card[]): FiveCardEvaluation {
  const counts = new Map<number, number>();
  const suits = new Map<Card['suit'], number>();
  const values: number[] = [];

  for (const card of cards) {
    const value = RANK_VALUES[card.rank];
    values.push(value);
    counts.set(value, (counts.get(value) ?? 0) + 1);
    suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  }

  const sortedValues = [...values].sort((a, b) => b - a);
  const uniqueValues = [...new Set(sortedValues)];
  const isFlush = Array.from(suits.values()).some((count) => count === 5);
  const straightHigh = detectStraightHigh(uniqueValues);
  const isStraight = straightHigh !== null;

  const countEntries = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });

  const primary = countEntries[0];
  const secondary = countEntries[1];

  if (isStraight && isFlush) {
    return {
      rankClass: 'straight-flush',
      tieBreakers: [straightHigh!],
      bestFive: cards,
      description: straightHigh === 14 ? 'Royal flush' : `Straight flush (${describeRanks(cards)})`,
    };
  }

  if (primary?.count === 4) {
    const kicker = countEntries.find((entry) => entry.count === 1)!.value;
    return {
      rankClass: 'four-of-a-kind',
      tieBreakers: [primary.value, kicker],
      bestFive: cards,
      description: `Four of a kind (${valueToLabel(primary.value)})`,
    };
  }

  if (primary?.count === 3 && secondary?.count === 2) {
    return {
      rankClass: 'full-house',
      tieBreakers: [primary.value, secondary.value],
      bestFive: cards,
      description: `Full house (${valueToLabel(primary.value)} full of ${valueToLabel(secondary.value)})`,
    };
  }

  if (isFlush) {
    return {
      rankClass: 'flush',
      tieBreakers: sortedValues,
      bestFive: cards,
      description: `Flush (${describeRanks(cards)})`,
    };
  }

  if (isStraight) {
    return {
      rankClass: 'straight',
      tieBreakers: [straightHigh!],
      bestFive: cards,
      description: `Straight (${describeStraight(straightHigh!)})`,
    };
  }

  if (primary?.count === 3) {
    const kickers = countEntries
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    return {
      rankClass: 'three-of-a-kind',
      tieBreakers: [primary.value, ...kickers],
      bestFive: cards,
      description: `Three of a kind (${valueToLabel(primary.value)})`,
    };
  }

  if (primary?.count === 2 && secondary?.count === 2) {
    const remaining = countEntries
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    const pairValues = [primary.value, secondary.value].sort((a, b) => b - a);
    return {
      rankClass: 'two-pair',
      tieBreakers: [...pairValues, ...remaining],
      bestFive: cards,
      description: `Two pair (${valueToLabel(pairValues[0])} & ${valueToLabel(pairValues[1])})`,
    };
  }

  if (primary?.count === 2) {
    const kickers = countEntries
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.value)
      .sort((a, b) => b - a);
    return {
      rankClass: 'pair',
      tieBreakers: [primary.value, ...kickers],
      bestFive: cards,
      description: `Pair of ${valueToLabel(primary.value)}s`,
    };
  }

  return {
    rankClass: 'high-card',
    tieBreakers: sortedValues,
    bestFive: cards,
    description: `High card ${valueToLabel(sortedValues[0])}`,
  };
}

function encodeHandStrength(rankClass: HandRankClass, tieBreakers: number[]): number {
  const category = HAND_RANK_ORDER.indexOf(rankClass);
  return tieBreakers.reduce((acc, value) => acc * BASE + value, category * BASE ** 6);
}

function detectStraightHigh(values: number[]): number | null {
  if (values.length < 5) {
    return null;
  }
  const sorted = [...values].sort((a, b) => b - a);
  if (sorted.length === 5 && sorted[0] - sorted[4] === 4) {
    return sorted[0];
  }
  // Wheel (A-2-3-4-5)
  if (
    sorted.includes(14) &&
    sorted.includes(5) &&
    sorted.includes(4) &&
    sorted.includes(3) &&
    sorted.includes(2)
  ) {
    return 5;
  }
  // For other cases with duplicate ranks we cannot have straight in five cards.
  return null;
}

function valueToLabel(value: number): string {
  const entries = Object.entries(RANK_VALUES) as [keyof typeof RANK_VALUES, number][];
  const entry = entries.find(([, v]) => v === value);
  return entry ? mapRankToName(entry[0]) : value.toString();
}

function mapRankToName(rank: keyof typeof RANK_VALUES): string {
  switch (rank) {
    case 'T':
      return 'Ten';
    case 'J':
      return 'Jack';
    case 'Q':
      return 'Queen';
    case 'K':
      return 'King';
    case 'A':
      return 'Ace';
    default:
      return rank;
  }
}

function describeRanks(cards: Card[]): string {
  return [...cards]
    .map((card) => cardToCode(card))
    .sort()
    .join(' ');
}

function describeStraight(high: number): string {
  if (high === 14) return 'Ace high';
  if (high === 5) return 'Five high';
  return `${valueToLabel(high)} high`;
}
