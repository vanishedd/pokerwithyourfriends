import { z } from 'zod';

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(20, 'Name must be 20 characters or fewer');

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,6}$/);

export const CreateRoomRequestSchema = z.object({
  name: PlayerNameSchema,
  stack: z
    .number({ invalid_type_error: 'Stack must be numeric' })
    .int('Stack must be an integer')
    .min(200, 'Stack must be at least 200 chips')
    .max(50000, 'Stack must be no more than 50000 chips')
    .default(2000),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const JoinRoomRequestSchema = z.object({
  name: PlayerNameSchema,
});

export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;

export const StartGameRequestSchema = z.object({
  token: z.string().min(10),
});

export const ToggleLockRequestSchema = z.object({
  token: z.string().min(10),
  locked: z.boolean(),
});

export const AuthorizeRequestSchema = z.object({
  token: z.string().min(10),
});

export type AuthorizeRequest = z.infer<typeof AuthorizeRequestSchema>;

export const ActionPayloadSchema = z.object({
  type: z.union([
    z.literal('fold'),
    z.literal('check'),
    z.literal('call'),
    z.literal('bet'),
    z.literal('raise'),
  ]),
  amount: z.number().int().min(0).optional(),
});

export type ActionPayload = z.infer<typeof ActionPayloadSchema>;
