## 23. UX priorities

The product should feel:

- lightweight
- fast
- uncluttered
- trustworthy
- transparent

### UX emphasis for v1

- quick entry of transactions
- clear category assignment workflow
- intuitive reconciliation
- clean import flow
- clear indication of native vs converted currency values
- smooth use from both desktop and mobile browsers

---

## 22. Open design questions

These do not block the project document, but should be refined during implementation.

1. Should category naming across currencies be duplicated explicitly in the UI, or should one conceptual category contain separate per-currency balances internally?
2. How much client-side local caching is worth supporting in v1 before it adds too much complexity?
3. Should exchange rates for reporting be entered manually at first, fetched from an API, or both?
4. How should fees for cross-currency transfer be categorized in the budget?
5. What minimum audit/history functionality should exist in a shared multi-user environment?
6. How should initial onboarding work for a migrated YNAB budget versus a fresh manual budget?
7. Should the first implementation support only one budget instance total, or one shared budget with future room for multiple budgets later?

---

## 23. Initial roadmap

### Phase 1: Core architecture

- set up self-hosted full-stack application
- set up PostgreSQL
- implement basic auth/session model
- implement core entities: users, accounts, categories, currencies

### Phase 2: Core budgeting flows

- transaction entry
- category assignment
- transfers
- reconciliation
- shared multi-user updates

### Phase 3: Import and migration

- CSV import pipeline
- YNAB CSV support
- preview + mapping interface

### Phase 4: Reporting and reliability

- summary dashboard
- charts/reports
- backups
- export tools

### Phase 5: Refinement

- improve mobile browser usability
- add stronger real-time syncing
- refine multi-currency reports
- consider desktop/mobile wrappers

---
