import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool as PgPool } from 'pg';
import { Pool } from 'pg';
import type { Pool as MySqlPool } from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import type { GameAction } from '@pwyf/shared';
import type { HandState, PlayerState, RoomState } from '../game/types';
import type { PersistenceAdapter } from './persistence';

export type SqlClient = PgPool | MySqlPool;

export interface SqlConfig {
  client: 'postgres' | 'mysql';
  connectionString?: string;
}

export class SqlPersistenceAdapter implements PersistenceAdapter {
  private pool: SqlClient | null = null;

  constructor(private readonly config: SqlConfig) {}

  async init(): Promise<void> {
    if (this.config.client === 'postgres') {
      this.pool = new Pool({ connectionString: this.config.connectionString });
    } else {
      this.pool = createPool({
        uri: this.config.connectionString,
        dateStrings: true,
        namedPlaceholders: true,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 5,
        multipleStatements: true,
      });
    }

    await this.ensureSchema();
  }

  async createRoom(room: RoomState): Promise<void> {
    if (!this.pool) return;
    const query =
      this.config.client === 'postgres'
        ? 'INSERT INTO rooms (code, host_id, is_locked) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING'
        : 'INSERT IGNORE INTO rooms (code, host_id, is_locked) VALUES (?, ?, ?)';
    const params = [room.code, room.hostId, room.isLocked];
    await this.execute(query, params);
  }

  async updateRoomLock(roomCode: string, locked: boolean): Promise<void> {
    if (!this.pool) return;
    const query =
      this.config.client === 'postgres'
        ? 'UPDATE rooms SET is_locked = $1 WHERE code = $2'
        : 'UPDATE rooms SET is_locked = ? WHERE code = ?';
    await this.execute(query, [locked, roomCode]);
  }

  async upsertPlayer(roomCode: string, player: PlayerState): Promise<void> {
    if (!this.pool) return;
    if (this.config.client === 'postgres') {
      await this.execute(
        `INSERT INTO players (room_id, name, stack, seat, token, connected)
         VALUES ((SELECT id FROM rooms WHERE code = $1), $2, $3, $4, $5, $6)
         ON CONFLICT (room_id, name)
         DO UPDATE SET stack = EXCLUDED.stack, seat = EXCLUDED.seat, token = EXCLUDED.token, connected = EXCLUDED.connected`,
        [roomCode, player.name, player.stack, player.seat, player.token, player.connected],
      );
    } else {
      await this.execute(
        `INSERT INTO players (room_id, name, stack, seat, token, connected)
         VALUES ((SELECT id FROM rooms WHERE code = ?), ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE stack = VALUES(stack), seat = VALUES(seat), token = VALUES(token), connected = VALUES(connected)`,
        [roomCode, player.name, player.stack, player.seat, player.token, player.connected],
      );
    }
  }

  async updatePlayerConnection(roomCode: string, playerToken: string, connected: boolean): Promise<void> {
    if (!this.pool) return;
    const query =
      this.config.client === 'postgres'
        ? 'UPDATE players SET connected = $1 WHERE token = $2 AND room_id = (SELECT id FROM rooms WHERE code = $3)'
        : 'UPDATE players SET connected = ? WHERE token = ? AND room_id = (SELECT id FROM rooms WHERE code = ?)';
    await this.execute(query, [connected, playerToken, roomCode]);
  }

  async recordHand(roomCode: string, hand: HandState): Promise<void> {
    if (!this.pool) return;
    const query =
      this.config.client === 'postgres'
        ? `INSERT INTO hands (room_id, hand_number, started_at, ended_at)
           VALUES ((SELECT id FROM rooms WHERE code = $1), $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0))`
        : `INSERT INTO hands (room_id, hand_number, started_at, ended_at)
           VALUES ((SELECT id FROM rooms WHERE code = ?), ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))`;
    await this.execute(query, [roomCode, hand.handNumber, hand.startedAt, hand.endedAt ?? Date.now()]);
  }

  async recordAction(roomCode: string, handNumber: number, action: GameAction): Promise<void> {
    if (!this.pool) return;
    const query =
      this.config.client === 'postgres'
        ? `INSERT INTO actions (hand_id, player_id, action_type, amount, created_at)
           VALUES (
             (SELECT h.id FROM hands h JOIN rooms r ON h.room_id = r.id WHERE r.code = $1 AND h.hand_number = $2),
             (SELECT p.id FROM players p JOIN rooms r ON p.room_id = r.id WHERE r.code = $1 AND p.token = $3),
             $4,
             $5,
             to_timestamp($6 / 1000.0)
           )`
        : `INSERT INTO actions (hand_id, player_id, action_type, amount, created_at)
           VALUES (
             (SELECT h.id FROM hands h JOIN rooms r ON h.room_id = r.id WHERE r.code = ? AND h.hand_number = ?),
             (SELECT p.id FROM players p JOIN rooms r ON p.room_id = r.id WHERE r.code = ? AND p.token = ?),
             ?,
             ?,
             FROM_UNIXTIME(? / 1000)
           )`;
    await this.execute(query, [roomCode, handNumber, action.playerId, action.type, action.amount ?? 0, action.createdAt]);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    const schemaPath = resolve(process.cwd(), 'apps/server/db/schema.sql');
    const contents = await readFile(schemaPath, 'utf-8');
    await this.execute(contents, []);
  }

  private async execute(query: string, params: unknown[]): Promise<void> {
    if (!this.pool) return;
    if (this.config.client === 'postgres') {
      const pg = this.pool as PgPool;
      await pg.query(query, params);
    } else {
      const mysql = this.pool as MySqlPool;
      await mysql.query(query, params as never);
    }
  }
}
