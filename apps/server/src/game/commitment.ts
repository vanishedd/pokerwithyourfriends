import { randomBytes, randomInt } from 'node:crypto';
import {
  DeckCommitment,
  CardReveal,
  Card,
  cardToCode,
  createDeck,
  shuffleDeck,
  hashCard,
  deriveDeckHash,
} from '@pwyf/shared';

export interface SecretCard {
  position: number;
  card: Card;
  salt: string;
  hash: string;
}

export interface CommittedDeck {
  deck: Card[];
  commitment: DeckCommitment & { masterSalt: string };
  secrets: SecretCard[];
}

export function generateCommittedDeck(): CommittedDeck {
  const deck = shuffleDeck(createDeck(), randomInt);
  const masterSalt = randomBytes(32).toString('hex');
  const hashedCards: string[] = [];
  const secrets: SecretCard[] = [];
  const codes = deck.map(cardToCode);

  codes.forEach((code, index) => {
    const salt = randomBytes(24).toString('hex');
    const hash = hashCard(index, code, salt);
    hashedCards.push(hash);
    secrets.push({ position: index, card: deck[index], salt, hash });
  });

  const deckHash = deriveDeckHash(codes, masterSalt);

  return {
    deck,
    commitment: { algorithm: 'sha256', deckHash, hashedCards, masterSalt },
    secrets,
  };
}

export function revealSecrets(secrets: SecretCard[], indices: number[]): CardReveal[] {
  return indices.map((position) => {
    const secret = secrets[position];
    if (!secret) {
      throw new Error(`Missing secret for card position ${position}`);
    }
    return {
      position: secret.position,
      card: secret.card,
      salt: secret.salt,
      hash: secret.hash,
    };
  });
}
