import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@pwyf/shared';
import { loadEnv } from './env';
import { MemoryPersistenceAdapter } from './store/persistence';
import { SqlPersistenceAdapter } from './store/db-store';
import { GameEngine } from './game/game-engine';
import { RoomManager } from './game/room-manager';
import { roomRoutes } from './routes/rooms';
import { healthRoutes } from './routes/health';

const env = loadEnv();

const logger = true;

async function bootstrap() {
  const fastify = Fastify({ logger });

  const persistence = env.dbEnabled && env.databaseUrl
    ? new SqlPersistenceAdapter({ client: env.dbClient, connectionString: env.databaseUrl })
    : new MemoryPersistenceAdapter();

  await persistence.init();

  const engine = new GameEngine(persistence);
  const manager = new RoomManager(persistence, engine);

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed'), false);
      }
    },
    credentials: true,
  });

  const clientDist = resolve(process.cwd(), 'apps/client/dist');
  if (existsSync(clientDist)) {
    await fastify.register(fastifyStatic, {
      root: clientDist,
    });
    fastify.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && request.url && !request.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      reply.code(404).send({ message: 'Not Found' });
    });
  }

  await fastify.register(healthRoutes);
  await fastify.register(roomRoutes(manager));

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(fastify.server, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
  });

  const namespace = io.of('/ws');
  manager.attachNamespace(namespace);

  const address = await fastify.listen({ port: env.port, host: env.host });
  fastify.log.info(`Server listening on ${address}`);

  const shutdown = async () => {
    await io.close();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});
