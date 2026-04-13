# Testing Log

## 2026-04-12 Manual Smoke Test

Environment:
- Workstation development environment
- Local Docker PostgreSQL instance
- Next.js dev server via `npm run dev`
- Browser-based manual verification

### Preconditions and setup notes

- `SESSION_SECRET` in `.env` had to be replaced with a value at least 16 characters long.
- Automatic database init now applies schema only. Optional bootstrap seed data is kept separate as a manual SQL file.

### Verified flows

1. Database startup and app boot
- `docker compose up db -d` succeeded after Docker daemon setup was fixed.
- `db/schema.sql` loaded successfully into a fresh database.
- Next.js dev server started successfully.

2. First-run setup
- With a fresh database volume and schema-only initialization, the app correctly exposed `/setup`.
- Owner creation succeeded.
- Budget creation succeeded.
- Session creation/sign-in after setup succeeded.

3. Accounts
- Manual account creation on `/accounts` succeeded.
- Account persisted to PostgreSQL.

4. Categories and budgeting
- Category group creation on `/categories` succeeded.
- Category creation with currency bucket selection succeeded.
- Manual budget assignment event entry succeeded.

5. Transactions
- Manual income transaction entry succeeded.
- Manual expense transaction entry succeeded.

6. Transfers and reconciliation
- Same-currency transfer validation was manually verified.
- A same-currency transfer with different source and destination amounts was correctly rejected.
- The current UI behavior for this case is functionally correct but not yet graceful.

7. Derived views
- Overview page rendered after setup and data entry.
- Accounts page reflected persisted account data.
- Category and transaction pages accepted and displayed created data.

### Issues discovered

1. Environment validation friction
- Placeholder `.env.example` value for `SESSION_SECRET` causes a runtime failure until replaced.
- This is expected behavior from validation, but it is a setup footgun for first-time local testing.

### Current confidence

- The initial end-to-end happy path is manually validated for:
  - setup
  - login/session creation
  - account creation
  - category/group creation
  - assignment entry
  - basic income/expense entry
  - same-currency transfer validation

- Not yet formally verified:
  - cross-currency behavior
  - full transfer persistence/display behavior
  - reconciliation workflow
  - import pipeline
  - backup/restore behavior
  - deployment on the actual home server target

## 2026-04-12 Automated Integration Test Pass

Environment:
- Local PostgreSQL database running in Docker
- Node test runner with `tsx`
- Integration harness using isolated PostgreSQL schemas

### Verified automated workflows

1. Bootstrap workflow
- Bootstrapping creates one owner user, one budget, and one membership.

2. Core budgeting workflow
- Account creation persists correctly.
- Category group and category bucket creation persist correctly.
- Budget assignment events persist correctly.
- Categorized expense transactions create both ledger rows and matching splits.
- Derived account balance math is correct for the tested scenario.

3. Transfer invariants
- Same-currency transfers with mismatched source and destination amounts are rejected.

4. Reconciliation workflow
- Reconciliation with explicit adjustment creates both a `reconciliation_event` and an adjustment transaction.

### Notes

- Integration coverage currently targets the extracted workflow layer and real PostgreSQL writes.
- Browser/UI behavior is still primarily covered by manual testing.
