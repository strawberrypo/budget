## 6. Deployment and access model

### Canonical deployment model

The system is server-centered.

- one local server hosts the application backend and canonical database
- clients connect to the server over the local network or through Tailscale
- the app is not publicly exposed to the internet by default
- the private network is assumed to be trusted for v1

### Client model

For v1, the primary client is a responsive web app.

- desktop browsers and mobile browsers should both be supported
- a native desktop or mobile wrapper may be added later

### Sync model

- the server is the canonical source of truth
- clients should feel responsive and may cache enough state for smooth operation
- if local caching causes unnecessary complexity, an all-server model is acceptable in v1
- real-time updates across clients are desirable, but architectural simplicity should take priority over aggressive offline features

---

## 7. Authentication and access philosophy

The app should avoid tedious authentication flows while still supporting identity and collaboration.

### v1 approach

- lightweight persistent authentication
- avoid repeated password entry for routine use
- users should remain signed in on trusted devices for long periods
- access is restricted to LAN or Tailscale-connected devices

### Why auth exists at all

Even in a trusted private network, lightweight identity is still useful for:

- distinguishing users in a shared budget
- attributing edits and changes
- supporting future audit/history features
- preventing accidental access from shared devices

This should be implemented in the least intrusive way practical.

---

## 19. Recommended technical architecture

## High-level recommendation

For v1, build a server-centered self-hosted web app with a responsive browser UI.

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend

Two viable options:

1. **Next.js full-stack app** for maximum simplicity in v1  
2. **Next.js frontend + FastAPI backend** if the backend logic becomes complex enough to justify separation

Initial recommendation: start with a single full-stack application unless backend complexity clearly demands separation.

### Database

- PostgreSQL

Rationale:

- better fit than SQLite for a multi-client server-centered system
- stronger concurrency and long-term extensibility
- appropriate for self-hosted deployment

### Sync / realtime

- begin with a simple server-centered model
- add real-time update mechanisms only as needed
- do not overengineer offline replication in v1

### Deployment

- Docker Compose on a home server

Likely services:

- web app/backend
- PostgreSQL database
- backup service

### Reporting/visualization

- Recharts or Chart.js

### Future wrappers

- Tauri for desktop wrapper later
- mobile wrapper later if desired

---
