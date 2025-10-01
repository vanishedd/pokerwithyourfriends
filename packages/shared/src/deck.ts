import { RANKS, SUITS, cardToCode } from './cards';
import type { Card, CardCode } from './types';

export type RandomInt = (upperExclusive: number) => number;

function defaultRandomInt(upperExclusive: number): number {
  return Math.floor(Math.random() * upperExclusive);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffleDeck(
  inputDeck: Card[] = createDeck(),
  randomIntFn: RandomInt = defaultRandomInt,
): Card[] {
  const deck = [...inputDeck];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomIntFn(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function drawCards(deck: Card[], count: number): { cards: Card[]; remaining: Card[] } {
  if (count < 0 || count > deck.length) {
    throw new Error('Cannot draw that many cards from deck');
  }
  const cards = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { cards, remaining };
}

export function convertCardCode(code: CardCode): Card {
  const rank = code[0] as Card['rank'];
  const suit = code[1] as Card['suit'];
  return { rank, suit };
}

export function sortByCode(cards: Card[]): string[] {
  return [...cards].map(cardToCode).sort();
}
