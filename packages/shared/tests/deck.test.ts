import { describe, expect, it } from 'vitest';
import { createDeck } from '../src/deck';
import { hashCard, deriveDeckHash, verifyReveal } from '../src/commitment';

const MASTER_SALT = 'test-salt';

describe('deck utilities', () => {
  it('creates a standard 52 card deck with unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const codes = deck.map((card) => `${card.rank}${card.suit}`);
    const unique = new Set(codes);
    expect(unique.size).toBe(52);
  });

  it('verifies per-card commitments correctly', () => {
    const deck = createDeck();
    const hashedCards = deck.map((card, index) => hashCard(index, card, `salt-${index}`));
    const commitment = {
      algorithm: 'sha256' as const,
      deckHash: deriveDeckHash(
        deck.map((card) => `${card.rank}${card.suit}`),
        MASTER_SALT,
      ),
      hashedCards,
    };

    const targetIndex = 12;
    const reveal = {
      position: targetIndex,
      card: deck[targetIndex],
      salt: `salt-${targetIndex}`,
      hash: hashedCards[targetIndex],
    };

    expect(verifyReveal(reveal, commitment)).toBe(true);
  });
});
