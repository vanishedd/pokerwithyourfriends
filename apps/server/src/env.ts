import { config } from 'dotenv';

config();

export interface EnvConfig {
  port: number;
  host: string;
  clientOrigins: string[];
  sessionSecret: string;
  dbEnabled: boolean;
  dbClient: 'postgres' | 'mysql';
  databaseUrl?: string;
}

export function loadEnv(): EnvConfig {
  const port = Number(process.env.PORT ?? 4000);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }

  const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const dbClientEnv = (process.env.DB_CLIENT ?? 'postgres').toLowerCase();
  if (!['postgres', 'mysql'].includes(dbClientEnv)) {
    throw new Error('DB_CLIENT must be postgres or mysql');
  }

  return {
    port,
    host: process.env.HOST ?? '0.0.0.0',
    clientOrigins,
    sessionSecret: process.env.SESSION_SECRET ?? 'change-me',
    dbEnabled: (process.env.DB_ENABLED ?? 'false').toLowerCase() === 'true',
    dbClient: dbClientEnv as 'postgres' | 'mysql',
    databaseUrl: process.env.DATABASE_URL,
  };
}
