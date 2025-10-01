import { describe, expect, it } from 'vitest';
import { evaluateCards } from '../src/evaluator';
import type { Card } from '../src/types';

function makeCard(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

describe('hand evaluator', () => {
  it('identifies a royal flush as the strongest hand', () => {
    const cards: Card[] = [
      makeCard('A', 'S'),
      makeCard('K', 'S'),
      makeCard('Q', 'S'),
      makeCard('J', 'S'),
      makeCard('T', 'S'),
      makeCard('2', 'D'),
      makeCard('3', 'H'),
    ];
    const result = evaluateCards(cards);
    expect(result.rankClass).toBe('straight-flush');
    expect(result.description.toLowerCase()).toContain('royal');
  });

  it('correctly ranks a full house over a flush with seven cards', () => {
    const cards: Card[] = [
      makeCard('K', 'H'),
      makeCard('K', 'D'),
      makeCard('K', 'S'),
      makeCard('9', 'H'),
      makeCard('9', 'S'),
      makeCard('2', 'H'),
      makeCard('4', 'H'),
    ];
    const result = evaluateCards(cards);
    expect(result.rankClass).toBe('full-house');
  });
});
