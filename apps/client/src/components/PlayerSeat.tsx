import type { PlayerView } from '@pwyf/shared';
import clsx from 'clsx';

interface PlayerSeatProps {
  player: PlayerView;
  isMe?: boolean;
  isDealer?: boolean;
  isCurrent?: boolean;
  lastAction?: string;
}

const statusLabels: Record<PlayerView['status'], string> = {
  waiting: 'Waiting',
  acting: 'Acting',
  folded: 'Folded',
  'all-in': 'All-in',
  out: 'Out',
  disconnected: 'Offline',
};

const PlayerSeat = ({ player, isMe, isDealer, isCurrent, lastAction }: PlayerSeatProps) => {
  const containerClasses = clsx(
    'relative flex w-36 flex-col items-center gap-2 rounded-2xl border-4 px-3 py-4 shadow-[0_10px_0_rgba(0,0,0,0.35)] transition',
    player.hasFolded
      ? 'border-slate-700 bg-slate-800/70 text-slate-400'
      : 'border-emerald-700 bg-emerald-900/70 text-amber-100',
    isCurrent && !player.hasFolded ? 'ring-4 ring-amber-400' : 'ring-0',
    !player.connected ? 'opacity-70' : 'opacity-100',
  );

  const chipColor = player.hasFolded ? 'bg-slate-700 text-slate-200' : 'bg-amber-500 text-slate-900';

  return (
    <div className={containerClasses}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-emerald-200">
        {player.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-amber-200">
          {player.name}
          {isMe && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-slate-900">YOU</span>}
          {isDealer && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-emerald-200">D</span>}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-100">
          <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', chipColor)}>
            {player.stack}
          </span>
          <span className="text-[11px] text-emerald-200/80">chips</span>
        </div>
      </div>
      <div className="h-[1px] w-12 bg-slate-800/60" />
      <div className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-wide text-emerald-100/90">
        <span>{statusLabels[player.status]}</span>
        {lastAction && <span className="rounded bg-slate-900/60 px-2 py-0.5 text-[10px] text-amber-200">{lastAction}</span>}
      </div>
      {player.hasFolded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border-2 border-rose-500 px-3 py-1 text-xs font-semibold uppercase text-rose-400">
            Folded
          </span>
        </div>
      )}
    </div>
  );
};

export default PlayerSeat;
