## 26. Initial roadmap

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

### Current implementation status

- Phase 1 is complete in the repository baseline.
- Phase 2 is partially complete:
  - transaction entry
  - category assignment
  - transfers
  - reconciliation
  - shared multi-user access for one budget
- Phase 3 has started:
  - CSV preview and staging exist
  - mapping and commit are still pending

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
