import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { cardToCode } from './cards';
import type { Card, CardReveal, DeckCommitment } from './types';

export function hashCard(position: number, card: Card | string, salt: string): string {
  const code = typeof card === 'string' ? card : cardToCode(card);
  return hashString(`${position}|${code}|${salt}`);
}

export function deriveDeckHash(cardCodes: string[], masterSalt: string): string {
  return hashString(`${cardCodes.join('|')}:${masterSalt}`);
}

export function verifyReveal(
  reveal: CardReveal,
  commitment: DeckCommitment,
): boolean {
  const hash = hashCard(reveal.position, reveal.card, reveal.salt);
  return commitment.hashedCards[reveal.position] === hash && hash === reveal.hash;
}

function hashString(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}
