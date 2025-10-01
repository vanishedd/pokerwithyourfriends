import type { Card } from '@pwyf/shared';
import clsx from 'clsx';

const suitSymbols: Record<Card['suit'], string> = {
  S: '?',
  H: '?',
  D: '?',
  C: '?',
};

const suitColors: Record<Card['suit'], string> = {
  S: 'text-slate-200',
  H: 'text-rose-400',
  D: 'text-sky-300',
  C: 'text-emerald-300',
};

interface CardViewProps {
  card: Card;
  size?: 'sm' | 'md';
}

const CardView = ({ card, size = 'md' }: CardViewProps) => {
  const base = size === 'sm' ? 'w-10 h-14 text-lg' : 'w-12 h-16 text-xl';
  return (
    <div className={clsx('flex flex-col items-center justify-center rounded-lg border border-slate-600 bg-slate-950/70 shadow-inner', base)}>
      <span className="font-semibold">{card.rank}</span>
      <span className={clsx('font-semibold', suitColors[card.suit])}>{suitSymbols[card.suit]}</span>
    </div>
  );
};

export default CardView;
