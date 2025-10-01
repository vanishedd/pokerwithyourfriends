import { MemoryPersistenceAdapter } from '../src/store/persistence';
import { GameEngine } from '../src/game/game-engine';
import { RoomManager } from '../src/game/room-manager';

const persistence = new MemoryPersistenceAdapter();
const engine = new GameEngine(persistence);
const manager = new RoomManager(persistence, engine);

async function main() {
  const host = await manager.createRoom('Host', 2000);
  console.log('room', host);
  const join1 = await manager.joinRoom(host.roomCode, 'Alice');
  const join2 = await manager.joinRoom(host.roomCode, 'Bob');
  console.log('players added');
  await manager.startHand(host.roomCode, host.playerToken);
  const room = (manager as any).rooms.get(host.roomCode);
  console.log('hand', room.hand);
  console.log('players', room.players.map((p: any) => ({ name: p.name, seat: p.seat, bet: p.bet, stack: p.stack, hasFolded: p.hasFolded }));
}

main();
