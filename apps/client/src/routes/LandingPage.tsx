import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../api/client';
import useRoomStore, { saveSession, loadSession } from '../store/useRoomStore';

const LandingPage = () => {
  const navigate = useNavigate();
  const connect = useRoomStore((state) => state.connect);
  const setError = useRoomStore((state) => state.setError);

  const [hostName, setHostName] = useState('');
  const [stack, setStack] = useState(2000);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hostName.trim()) return;
    setLoading(true);
    try {
      const response = await createRoom({ name: hostName.trim(), stack });
      const session = {
        roomCode: response.roomCode,
        token: response.playerToken,
        playerId: response.playerId,
      };
      saveSession(session);
      connect(session);
      navigate(`/room/${response.roomCode}`);
    } catch (error) {
      console.error(error);
      setError('Unable to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || !joinName.trim()) return;
    setLoading(true);
    try {
      const response = await joinRoom(code, { name: joinName.trim() });
      const session = {
        roomCode: code,
        token: response.token,
        playerId: response.playerId,
      };
      saveSession(session);
      connect(session);
      navigate(`/room/${code}`);
    } catch (error) {
      console.error(error);
      setError('Unable to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const session = loadSession(code);
    if (!session) {
      setError('No saved session for that room');
      return;
    }
    connect(session);
    navigate(`/room/${code}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-4xl grid gap-8 md:grid-cols-2">
        <section className="rounded-2xl bg-slate-900/70 p-6 shadow-xl border border-slate-800">
          <h1 className="text-2xl font-semibold mb-4">Start a Table</h1>
          <p className="text-sm text-slate-300 mb-6">
            Create a private room, invite friends, and control the game.
          </p>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="hostName">
                Your Name
              </label>
              <input
                id="hostName"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:outline-none focus:ring focus:ring-emerald-500"
                maxLength={20}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="stack">
                Starting Stack
              </label>
              <input
                id="stack"
                type="number"
                min={200}
                max={50000}
                step={100}
                value={stack}
                onChange={(event) => setStack(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:outline-none focus:ring focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-slate-900/70 p-6 shadow-xl border border-slate-800">
          <h2 className="text-2xl font-semibold mb-4">Join or Resume</h2>
          <p className="text-sm text-slate-300 mb-6">
            Enter a room code from a friend, or resume a previous session.
          </p>
          <form className="space-y-4" onSubmit={handleJoin}>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="joinCode">
                Room Code
              </label>
              <input
                id="joinCode"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 uppercase tracking-[0.3em] text-center focus:outline-none focus:ring focus:ring-emerald-500"
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="joinName">
                Your Name
              </label>
              <input
                id="joinName"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus:outline-none focus:ring focus:ring-emerald-500"
                maxLength={20}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? 'Joining…' : 'Join Room'}
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 transition hover:border-emerald-500 hover:text-emerald-400"
              >
                Resume
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
