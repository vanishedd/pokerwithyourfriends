# Poker With Your Friends

Poker With Your Friends is a private, real-time Texas Hold'em app tailored for small groups (2–6 players). The Fastify server runs the authoritative game engine and Socket.IO namespace (`/ws`) keeps clients in sync. A responsive Vite + React client provides a clean lobby and table experience across desktop and tablets.

## Features
- Secure, server-driven Hold'em engine with blinds, betting phases, all-in handling, and pot splitting.
- Deck commitments with salted hashes and per-card reveals verified on the client.
- In-memory state by default with optional PostgreSQL/MySQL persistence driven from `schema.sql`.
- Zustand-powered client state, Tailwind UI components, and chat panel.
- pnpm workspace wiring for shared TypeScript types, game logic, and utilities.

## Project Structure
```
apps/
  client/   # Vite + React front-end
  server/   # Fastify + Socket.IO back-end
packages/
  shared/   # Shared types, deck helpers, evaluator, validation
```

## Prerequisites
- Node.js 20+
- pnpm 8+

## Local Development
```bash
pnpm install
pnpm dev
```
The command runs both the Fastify API (defaults to `http://localhost:4000`) and the Vite client (`http://localhost:5173`). The server reads `.env` variables; copy `.env.example` to configure host, DB, or origins as needed.

### Linting and Tests
```bash
pnpm lint    # Type-checks all workspaces
pnpm test    # Runs shared package unit tests (deck + evaluator)
```

## Database (Optional)
Set `DB_ENABLED=true` and provide `DATABASE_URL` plus `DB_CLIENT` (`postgres` or `mysql`) to persist rooms, players, hands, and actions. On startup the server applies `apps/server/db/schema.sql`.

## Docker
A `docker-compose.yml` is provided. To run server + client:
```bash
docker compose --profile app up --build
```
Enable the database profile with `--profile db` if you want a local Postgres container.

## Environment Variables
Key variables (see `.env.example`):
- `PORT`, `HOST` – Fastify listen address
- `CLIENT_ORIGIN` – Comma-separated origins for CORS / Socket.IO
- `SESSION_SECRET` – Session entropy
- `DB_ENABLED`, `DB_CLIENT`, `DATABASE_URL`

## Verification
Shared package Vitest specs ensure deck commitment and hand evaluation correctness. Client double-checks every revealed card against the published hashed deck.

Enjoy the game!
