import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import {
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  StartGameRequestSchema,
  ToggleLockRequestSchema
} from '@pwyf/shared';
import type { RoomManager } from '../game/room-manager';

function badRequest(reply: FastifyReply, message: string, details?: unknown) {
  reply.code(400).send({ message, details });
}

export const roomRoutes = (manager: RoomManager): FastifyPluginAsync => async (fastify) => {
  fastify.post('/api/rooms', async (request, reply) => {
    const parsed = CreateRoomRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return badRequest(reply, 'Invalid room payload', parsed.error.flatten());
    }
    const { name, stack } = parsed.data;
    const result = await manager.createRoom(name, stack);
    return reply.code(201).send(result);
  });

  fastify.post('/api/rooms/:code/join', async (request, reply) => {
    const parsed = JoinRoomRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return badRequest(reply, 'Invalid join payload', parsed.error.flatten());
    }
    const code = String((request.params as { code: string }).code).toUpperCase();
    try {
      const result = await manager.joinRoom(code, parsed.data.name);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : 'Unable to join' });
    }
  });

  fastify.post('/api/rooms/:code/start', async (request, reply) => {
    const parsed = StartGameRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return badRequest(reply, 'Invalid start payload', parsed.error.flatten());
    }
    const code = String((request.params as { code: string }).code).toUpperCase();
    try {
      await manager.startHand(code, parsed.data.token);
      return reply.code(204).send();
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : 'Unable to start hand' });
    }
  });

  fastify.post('/api/rooms/:code/lock', async (request, reply) => {
    const parsed = ToggleLockRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return badRequest(reply, 'Invalid lock payload', parsed.error.flatten());
    }
    const code = String((request.params as { code: string }).code).toUpperCase();
    try {
      await manager.toggleLock(code, parsed.data.token, parsed.data.locked);
      return reply.code(204).send();
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : 'Unable to update lock' });
    }
  });

  fastify.get('/api/rooms/:code', async (request, reply) => {
    const params = request.params as { code: string };
    const query = request.query as { token?: string };
    if (!query.token) {
      return badRequest(reply, 'token query parameter is required');
    }
    const code = String(params.code).toUpperCase();
    try {
      const snapshot = manager.getSnapshot(code, query.token);
      return reply.send({ room: snapshot });
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : 'Unable to fetch room' });
    }
  });
};


