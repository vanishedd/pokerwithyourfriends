import type { PlayerView, RoomSnapshot } from '@pwyf/shared';
import CardView from './CardView';
import PlayerSeat from './PlayerSeat';

interface GameTableProps {
  snapshot: RoomSnapshot;
  me?: PlayerView;
  lastActions: Map<string, string>;
}

const seatGroups = {
  bottom: [0, 1],
  left: [2],
  top: [3, 4],
  right: [5],
};

const GameTable = ({ snapshot, me, lastActions }: GameTableProps) => {
  const playersBySeat = new Map<number, PlayerView>();
  snapshot.players.forEach((player) => {
    if (player.seat !== null) {
      playersBySeat.set(player.seat, player);
    }
  });

  const lobbyPlayers = snapshot.players.filter((player) => player.seat === null);

  const getPlayers = (seats: number[]) => seats.map((seat) => playersBySeat.get(seat)).filter(Boolean) as PlayerView[];

  const top = getPlayers(seatGroups.top);
  const bottom = getPlayers(seatGroups.bottom);
  const left = getPlayers(seatGroups.left);
  const right = getPlayers(seatGroups.right);

  const myCards = snapshot.holeCards?.[0]?.cards ?? [];

  const renderSeats = (seats: PlayerView[], orientation: 'row' | 'column') => (
    <div className={orientation === 'row' ? 'flex flex-wrap justify-center gap-6' : 'flex flex-col items-center gap-6'}>
      {seats.map((player) => (
        <PlayerSeat
          key={player.id}
          player={player}
          isMe={player.id === me?.id}
          isDealer={snapshot.dealerSeat === player.seat}
          isCurrent={snapshot.currentSeat === player.seat}
          lastAction={lastActions.get(player.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="relative flex min-h-[60vh] w-full items-center justify-center">
      <div className="absolute inset-0 rounded-[42px] border-8 border-emerald-900 bg-gradient-to-b from-emerald-900 via-emerald-950 to-emerald-900 shadow-[0_40px_0_rgba(0,0,0,0.5)]" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-10">
        {renderSeats(top, 'row')}

        <div className="flex w-full items-center justify-between gap-6">
          <div className="flex flex-col items-center gap-6">
            {renderSeats(left, 'column')}
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 rounded-3xl border-4 border-slate-900 bg-slate-950/70 px-6 py-4 shadow-[0_18px_0_rgba(0,0,0,0.45)]">
              {snapshot.board.length ? (
                snapshot.board.map((card, index) => (
                  <div key={`${card.rank}${card.suit}${index}`} className="rounded-xl border-2 border-slate-800 bg-amber-100 p-1 shadow-[0_10px_0_rgba(0,0,0,0.4)]">
                    <CardView card={card} />
                  </div>
                ))
              ) : (
                <span className="text-xs uppercase tracking-widest text-amber-200/70">Board pending</span>
              )}
            </div>

            {myCards.length > 0 && (
              <div className="flex items-center gap-3 rounded-full border-4 border-emerald-700 bg-emerald-900/70 px-5 py-2 text-xs uppercase tracking-widest text-emerald-100 shadow-[0_12px_0_rgba(0,0,0,0.4)]">
                {myCards.map((card) => (
                  <div key={`${card.rank}${card.suit}`} className="rounded-lg border-2 border-emerald-600 bg-emerald-100 p-1 shadow-[0_8px_0_rgba(0,0,0,0.35)]">
                    <CardView card={card} />
                  </div>
                ))}
                <span>Your hand</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-6">
            {renderSeats(right, 'column')}
          </div>
        </div>

        {renderSeats(bottom, 'row')}

        {lobbyPlayers.length > 0 && (
          <div className="rounded-3xl border-4 border-slate-800 bg-slate-950/70 px-4 py-3 text-xs uppercase tracking-widest text-slate-200 shadow-[0_18px_0_rgba(0,0,0,0.45)]">
            <span className="font-semibold text-emerald-200">Lobby:</span>{' '}
            {lobbyPlayers.map((player, index) => (
              <span key={player.id}>
                {player.name}
                {index < lobbyPlayers.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameTable;

