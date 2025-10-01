import { useEffect, useMemo, useState } from 'react';
import type { ActionPayload, PlayerView, RoomSnapshot } from '@pwyf/shared';
import clsx from 'clsx';

interface ActionControlsProps {
  snapshot: RoomSnapshot;
  me: PlayerView;
  onAction: (payload: ActionPayload) => void;
  disabled?: boolean;
  locked?: boolean;
  lockedLabel?: string;
}

const ActionControls = ({ snapshot, me, onAction, disabled, locked, lockedLabel }: ActionControlsProps) => {
  const toCall = Math.max(0, snapshot.currentBet - me.bet);
  const canCheck = snapshot.currentBet === me.bet;
  const canCall = toCall > 0 && me.stack > 0;
  const maxTotalBet = me.bet + me.stack;

  const minRaiseTotal = useMemo(() => {
    if (snapshot.currentBet === 0) {
      return Math.min(maxTotalBet, snapshot.bigBlind);
    }
    const minIncrement = snapshot.minimumRaise ?? snapshot.bigBlind;
    return Math.min(maxTotalBet, snapshot.currentBet + minIncrement);
  }, [snapshot.currentBet, snapshot.minimumRaise, snapshot.bigBlind, maxTotalBet]);

  const [betTotal, setBetTotal] = useState(minRaiseTotal);

  useEffect(() => {
    setBetTotal(minRaiseTotal);
  }, [minRaiseTotal]);

  const isLocked = Boolean(locked);

  const handleAction = (payload: ActionPayload) => {
    if (isLocked || disabled) return;
    onAction(payload);
  };

  const raiseLabel = snapshot.currentBet === 0 ? 'Bet' : 'Raise';

  return (
    <div className="relative">
      <div
        className={clsx(
          'rounded-3xl border-4 border-slate-800 bg-slate-900/90 p-6 text-slate-100 shadow-[0_18px_0_rgba(0,0,0,0.45)] transition',
          (disabled || isLocked) && 'opacity-70',
        )}
      >
        <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-emerald-200">
          <span>Your stack: {me.stack}</span>
          <span>To call: {toCall}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleAction({ type: 'fold' })}
            disabled={isLocked || disabled || me.hasFolded}
            className="rounded-2xl border-4 border-rose-700 bg-rose-600 px-4 py-4 text-lg font-extrabold uppercase tracking-widest text-slate-900 shadow-[0_12px_0_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_0_rgba(0,0,0,0.4)] disabled:pointer-events-none disabled:opacity-60"
          >
            Fold
          </button>

          <button
            type="button"
            onClick={() => handleAction({ type: canCheck ? 'check' : 'call', amount: canCheck ? undefined : snapshot.currentBet })}
            disabled={isLocked || disabled || (!canCheck && !canCall)}
            className="rounded-2xl border-4 border-sky-700 bg-sky-500 px-4 py-4 text-lg font-extrabold uppercase tracking-widest text-slate-900 shadow-[0_12px_0_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_0_rgba(0,0,0,0.4)] disabled:pointer-events-none disabled:opacity-60"
          >
            {canCheck ? 'Check' : `Call ${toCall}`}
          </button>

          <button
            type="button"
            onClick={() => handleAction({ type: snapshot.currentBet === 0 ? 'bet' : 'raise', amount: Math.max(minRaiseTotal, Math.min(betTotal, maxTotalBet)) })}
            disabled={isLocked || disabled || me.stack === 0}
            className="rounded-2xl border-4 border-emerald-700 bg-emerald-500 px-4 py-4 text-lg font-extrabold uppercase tracking-widest text-slate-900 shadow-[0_12px_0_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_0_rgba(0,0,0,0.4)] disabled:pointer-events-none disabled:opacity-60"
          >
            {raiseLabel}
          </button>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border-4 border-slate-800 bg-slate-950/60 p-4 text-xs uppercase tracking-widest text-emerald-200/90">
          <div className="flex items-center justify-between">
            <span>Raise to</span>
            <span>{Math.max(minRaiseTotal, Math.min(betTotal, maxTotalBet))}</span>
          </div>
          <input
            type="range"
            min={minRaiseTotal}
            max={maxTotalBet}
            value={Math.max(minRaiseTotal, Math.min(betTotal, maxTotalBet))}
            step={snapshot.bigBlind}
            onChange={(event) => setBetTotal(Number(event.target.value))}
            className="w-full accent-emerald-500"
            disabled={isLocked || disabled || me.stack === 0}
          />
          <div className="flex justify-between text-[10px] text-emerald-200/60">
            <span>{minRaiseTotal}</span>
            <span>{maxTotalBet}</span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleAction({ type: 'raise', amount: maxTotalBet })}
              disabled={isLocked || disabled || me.stack === 0}
              className="rounded-lg border border-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200 transition hover:border-emerald-400 disabled:pointer-events-none disabled:opacity-60"
            >
              All-in
            </button>
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-slate-950/60 backdrop-blur-sm">
          <span className="rounded-full border-2 border-slate-700 bg-slate-900/70 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-slate-200">
            {lockedLabel ?? 'Waiting for other players'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ActionControls;
