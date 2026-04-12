# Budget

Self-hosted, privacy-first, multi-currency envelope budgeting app for LAN and Tailscale access.

## Stack

- Next.js 15 with the App Router
- TypeScript
- PostgreSQL
- Docker Compose

## Local Development

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Generate a bootstrap password hash with `npm run hash-password -- <password>` and replace the placeholder in `db/seed.sql`.
4. Start PostgreSQL with `docker compose up db -d`.
5. Run `npm run dev`.

## Deployment Model

The default deployment target is a small home server reachable over a private LAN or Tailscale. The canonical deployment uses:

- `app`: Next.js server
- `db`: PostgreSQL
- `backup`: optional periodic database backups

## Current Status

This repository contains the initial application scaffold, domain model types, starter auth/session plumbing, and the first PostgreSQL schema draft aligned with the project docs in [`docs`](docs).
