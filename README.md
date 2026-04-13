# Budget

Self-hosted, privacy-first, multi-currency envelope budgeting app for LAN and Tailscale access.

## Stack

- Next.js 16 with the App Router
- TypeScript
- PostgreSQL
- Docker Compose

## Local Development

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Replace `SESSION_SECRET` in `.env` with a value at least 16 characters long.
4. Start PostgreSQL with `docker compose up db -d`.
5. Run `npm run dev`.
6. Open `http://localhost:3000/setup` on a fresh database.

## Optional Manual Seed

If you want a prebuilt bootstrap user instead of using `/setup`, generate a password hash:

```bash
npm run hash-password -- <password>
```

Then replace the placeholder in `db/manual-seed.sql` and apply it manually:

```bash
docker compose exec -T db psql -U budget -d budget < db/manual-seed.sql
```

## Deployment Model

The default deployment target is a small home server reachable over a private LAN or Tailscale. The canonical deployment uses:

- `app`: Next.js server
- `db`: PostgreSQL
- `backup`: optional periodic database backups

## Current Status

This repository now includes:

- first-run setup and local session auth
- account, category, assignment, and transaction workflows
- edit/void correction flows for existing records
- transfer and reconciliation workflows
- a small automated test suite for core ledger rules

Known UX rough edge:

- same-currency transfers correctly reject mismatched source/destination amounts, but the UI currently surfaces that as a simple error redirect rather than inline form validation.
