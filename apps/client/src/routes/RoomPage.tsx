import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GameAction } from '@pwyf/shared';
import { startHand, toggleLock } from '../api/client';
import useRoomStore, { loadSession, saveSession } from '../store/useRoomStore';
import GameTable from '../components/GameTable';
import ActionControls from '../components/ActionControls';

const describeAction = (action: GameAction) => {
  switch (action.type) {
    case 'fold':
      return 'Folded';
    case 'check':
      return 'Checked';
    case 'call':
      return action.amount ? `Called ${action.amount}` : 'Called';
    case 'bet':
      return action.amount ? `Bet ${action.amount}` : 'Bet';
    case 'raise':
      return action.amount ? `Raised to ${action.amount}` : 'Raised';
    default:
      return '';
  }
};

const RoomPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const {
    status,
    session,
    snapshot,
    connect,
    fetchSnapshot,
    sendAction,
    setError,
    error,
  } = useRoomStore((state) => state);

  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;
    const roomCode = code.toUpperCase();
    const activeSession = session && session.roomCode === roomCode ? session : loadSession(roomCode);
    if (!activeSession) {
      setError('Session not found. Join again from the home page.');
      navigate('/');
      return;
    }
    saveSession(activeSession);
    if (status === 'idle' || !session || session.roomCode !== roomCode) {
      connect(activeSession);
    }
    fetchSnapshot(activeSession).catch(() => setError('Unable to fetch room state'));
  }, [code]);

  useEffect(() => {
    if (!snapshot?.nextHandAt) {
      setCountdown(null);
      return;
    }
    const update = () => {
      const diff = snapshot.nextHandAt - Date.now();
      setCountdown(diff > 0 ? Math.ceil(diff / 1000) : 0);
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [snapshot?.nextHandAt]);

  const me = useMemo(() => {
    if (!snapshot || !session) return undefined;
    return snapshot.players.find((player) => player.id === session.playerId);
  }, [snapshot, session]);

  const activePlayer = useMemo(() => {
    if (!snapshot) return undefined;
    return snapshot.players.find((player) => player.seat === snapshot.currentSeat);
  }, [snapshot]);

  const lastActions = useMemo(() => {
    const map = new Map<string, string>();
    if (!snapshot?.pendingActions) {
      return map;
    }
    snapshot.pendingActions.forEach((action) => {
      map.set(action.playerId, describeAction(action));
    });
    return map;
  }, [snapshot?.pendingActions, snapshot?.handNumber]);

  const actionLog = useMemo(() => {
    if (!snapshot?.pendingActions) return [] as { id: string; label: string }[];
    return snapshot.pendingActions
      .map((action) => {
        const player = snapshot.players.find((entry) => entry.id === action.playerId);
        const label = describeAction(action);
        return {
          id: action.id,
          label: `${player?.name ?? 'Player'}: ${label || action.type}`,
        };
      })
      .slice(-10)
      .reverse();
  }, [snapshot?.pendingActions, snapshot?.players]);

  const isHost = me?.isHost ?? false;
  const isMyTurn = Boolean(snapshot && me && snapshot.currentSeat === me.seat && snapshot.phase !== 'complete');

  const handleStart = async () => {
    if (!session || !code) return;
    setBusy(true);
    try {
      await startHand(code.toUpperCase(), session.token);
    } catch (err) {
      console.error(err);
      setError('Failed to start hand');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLock = async () => {
    if (!session || !code || !snapshot) return;
    setBusy(true);
    try {
      await toggleLock(code.toUpperCase(), session.token, !snapshot.isLocked);
    } catch (err) {
      console.error(err);
      setError('Failed to update lock status');
    } finally {
      setBusy(false);
    }
  };

  const waitingMessage = useMemo(() => {
    if (!snapshot) return '';
    if (snapshot.phase === 'lobby') {
      return isHost ? 'You control the table. Start when everyone is ready.' : 'Waiting for the host to start the table.';
    }
    if (snapshot.phase === 'complete') {
      if (snapshot.nextHandAt) {
        return countdown !== null ? `Next hand starts in ${countdown}s` : 'Preparing next hand';
      }
      return 'Waiting for players to be ready';
    }
    if (isMyTurn) {
      return "It's your turn. Choose an action.";
    }
    if (activePlayer) {
      return `Waiting for ${activePlayer.name}`;
    }
    return 'Waiting for players';
  }, [snapshot, countdown, isMyTurn, isHost, activePlayer]);

  if (!code || !session || !snapshot || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1b1827] text-slate-200">
        <p>Connecting to room.</p>
      </div>
    );
  }

  const summary = snapshot.lastSummary;
  const summaryWinners = summary
    ? summary.winners.map((winner) => {
        const winnerPlayer = snapshot.players.find((player) => player.id === winner.playerId);
        const label = winnerPlayer
          ? winnerPlayer.id === me.id
            ? 'You win'
            : `${winnerPlayer.name} wins`
          : 'Winner';
        return {
          ...winner,
          label,
          name: winnerPlayer?.name ?? 'Player',
        };
      })
    : [];
  const overlayWinner = summaryWinners.find((winner) => winner.playerId === me.id) ?? summaryWinners[0];
  const splitNames = overlayWinner
    ? summaryWinners.filter((winner) => winner.playerId !== overlayWinner.playerId).map((winner) => winner.name)
    : [];

  const activePlayerAction = activePlayer ? lastActions.get(activePlayer.id) : undefined;
  const actionLocked = snapshot.phase === 'complete' || !isMyTurn;
  const lockedLabel = snapshot.phase === 'complete'
    ? snapshot.nextHandAt && countdown !== null
      ? `Next hand in ${countdown}s`
      : 'Hand complete'
    : !isMyTurn
      ? activePlayer
        ? activePlayerAction
          ? `${activePlayer.name}: ${activePlayerAction}`
          : `${activePlayer.name} is acting`
        : 'Waiting for players'
      : undefined;

  return (
    <div className="relative min-h-screen bg-[#1b1827] pb-36 text-amber-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2b2444_0%,#161221_65%,#100d19_100%)]" />
      <header className="relative border-b-4 border-slate-900/60 bg-slate-950/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border-4 border-amber-500 bg-amber-400 px-4 py-2 text-lg font-black uppercase tracking-widest text-slate-900 shadow-[0_8px_0_rgba(0,0,0,0.35)]">
              Poker With Friends
            </div>
            <div className="rounded-2xl border-4 border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-200 shadow-[0_6px_0_rgba(0,0,0,0.35)]">
              <div>Room {snapshot.code}</div>
              <div>Hand #{snapshot.handNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border-2 border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-200">
              Blinds {snapshot.smallBlind}/{snapshot.bigBlind}
            </span>
            {isHost && (
              <>
                <button
                  type="button"
                  onClick={handleToggleLock}
                  disabled={busy}
                  className="rounded-xl border-4 border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-200 transition hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
                >
                  {snapshot.isLocked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={busy || (snapshot.phase !== 'lobby' && snapshot.phase !== 'complete')}
                  className="rounded-xl border-4 border-emerald-700 bg-emerald-500 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-900 transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(0,0,0,0.35)] disabled:opacity-50"
                >
                  Start Hand
                </button>
              </>
            )}
            <span className="rounded-full border-2 border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-200">
              Seat {me.seat ?? 'Lobby'}
            </span>
          </div>
        </div>
        <div className="border-t border-slate-800/60 bg-slate-950/40 text-center text-[11px] font-semibold uppercase tracking-widest text-emerald-200/80">
          <div className="mx-auto max-w-4xl px-4 py-2">{waitingMessage}</div>
        </div>
      </header>

      {error && (
        <div className="relative bg-rose-500/20 text-rose-200">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm">{error}</div>
        </div>
      )}

      {overlayWinner && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="rounded-3xl border-4 border-emerald-600 bg-emerald-900/95 px-8 py-6 text-center text-emerald-100 shadow-[0_24px_0_rgba(0,0,0,0.5)]">
            <div className="text-lg font-black uppercase tracking-widest">{overlayWinner.label}</div>
            <div className="mt-2 text-sm text-emerald-200">{overlayWinner.bestHand.description}</div>
            {splitNames.length > 0 && (
              <div className="mt-3 text-xs text-emerald-200/80">
                Split pot with {splitNames.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8">
        <div className="flex flex-col-reverse gap-6 lg:flex-row">
          <aside className="w-full max-w-xs rounded-3xl border-4 border-slate-800 bg-slate-950/70 px-4 py-4 text-xs uppercase tracking-widest text-emerald-200 shadow-[0_18px_0_rgba(0,0,0,0.45)]">
            <div className="mb-2 text-sm font-bold text-amber-200">Action Log</div>
            <div className="flex flex-col gap-1 text-[11px] text-emerald-100/90">
              {actionLog.length === 0 && <span>No actions yet.</span>}
              {actionLog.map((entry) => (
                <span key={entry.id} className="rounded bg-slate-900/60 px-2 py-1">
                  {entry.label}
                </span>
              ))}
            </div>
          </aside>
          <section className="flex-1">
            <GameTable snapshot={snapshot} me={me} lastActions={lastActions} />
          </section>
        </div>

        {summary && (
          <div className="rounded-3xl border-4 border-emerald-700 bg-emerald-800/20 px-6 py-4 text-sm text-emerald-200 shadow-[0_16px_0_rgba(0,0,0,0.35)]">
            <div className="font-semibold text-emerald-100">Hand #{summary.handNumber} complete</div>
            <ul className="mt-2 space-y-1 text-xs">
              {summaryWinners.map((winner) => (
                <li key={winner.playerId}>
                  {winner.label} {winner.amount} chips - {winner.bestHand.description}
                </li>
              ))}
            </ul>
            {snapshot.nextHandAt && countdown !== null && (
              <div className="mt-2 text-[11px] text-emerald-300/80">Next hand begins in {countdown}s</div>
            )}
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed bottom-8 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-4">
        <div className="pointer-events-auto">
          <ActionControls
            snapshot={snapshot}
            me={me}
            onAction={sendAction}
            disabled={busy}
            locked={actionLocked}
            lockedLabel={lockedLabel}
          />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
