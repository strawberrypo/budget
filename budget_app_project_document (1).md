# Budget App Project Document

## Working title

A self-hosted, privacy-first, multi-currency envelope budgeting app for local networks and private VPN access.

---

## 1. Vision

Build a lightweight budgeting app inspired by the YNAB envelope-budgeting philosophy, but designed from the start to be:

- local-first and privacy-first
- self-hosted on user-owned infrastructure
- accessible across devices on a home network or through a private VPN such as Tailscale
- collaborative across multiple users on a shared budget
- capable of handling multiple currencies correctly in one unified system

The app should feel like a cloud service in day-to-day use, but without relying on third-party cloud storage or public internet exposure.

---

## 2. Product philosophy

### Core principles

1. **Privacy first**\
   Financial data stays under the user's control. The canonical database runs on infrastructure the user owns and trusts.

2. **Local-first deployment**\
   The system is designed to run on a home server or other private machine. Clients access it over LAN or through Tailscale.

3. **Budgeting over passive tracking**\
   This is not just an expense tracker. It is an intentional budgeting tool based on envelope budgeting.

4. **Correctness over convenience**\
   Core accounting and budgeting behavior should be conceptually sound, even if some convenience features are postponed.

5. **Lightweight and focused**\
   The product should stay simple. Avoid feature bloat, especially in v1.

6. **Multi-currency as a first-class concept**\
   Multiple currencies should be handled natively rather than forced into a single-currency workaround.

7. **Modular extensibility**\
   Reports, savings goals, and other advanced features should be layered cleanly on top of a stable core model.

---

## 3. Problem statement

Most budgeting tools today have one or more of the following drawbacks:

- they are cloud-first and require users to trust third-party servers with sensitive financial data
- they rely heavily on bank integrations and aggregation services
- they are feature-heavy and cumbersome for users who want a clean budgeting workflow
- they do not support multi-currency budgeting well, especially when a user wants to manage accounts in different currencies in a single system
- they are not well suited to self-hosted or privacy-conscious workflows

This project aims to fill that gap with a focused, self-hosted budgeting system.

---

## 4. Target use case

The primary intended use case is:

- the app runs on a home server or other private machine
- the database is accessible in real time to devices on the local network or connected through Tailscale
- users access the app from a desktop browser or mobile browser
- multiple users collaborate on one shared household budget
- budgeting follows a YNAB-like envelope system
- accounts may exist in multiple currencies

---

## 5. v1 scope

Version 1 should focus on a solid core architecture and correct budgeting behavior.

### Included in v1

- manual account management
- manual transaction entry
- CSV transaction import
- shared multi-user access to a single budget
- envelope/category budgeting
- money assignment to budget categories
- transfers between accounts
- multi-currency support at a basic but correct level
- cross-client syncing through a central local server
- simple summary reports and data visualization
- manual reconciliation workflow
- automated database backups
- CSV/JSON export
- responsive browser-based client for desktop and mobile use

### Explicitly out of scope for v1

- direct bank syncing
- public internet exposure
- peer-to-peer sync without a central server
- investment portfolio tracking
- tax/accounting workflows
- advanced forecasting
- OCR receipt scanning
- AI categorization
- complex role/permission systems
- native desktop or mobile apps

---

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

## 8. Budgeting model

The budgeting model should draw strongly from YNAB.

### Core rule

Money lives in accounts, but every unit of money should be assigned to a budget category.

### Budget movement

Money moves through:

- income
- spending transactions
- transfers between accounts
- budget assignment/reassignment between categories

### Envelope budgeting behavior

The app should support a workflow where users:

- maintain account balances
- allocate available money into categories
- spend from accounts while tracking category effects
- move money between categories when priorities change

The product should emphasize budgeting and planning, not just historical spending review.

---

## 9. Multi-user model

Version 1 supports:

- multiple users
- one shared budget
- collaborative editing of that shared budget

V1 does **not** attempt to support multi-tenant hosting of multiple completely separate budgets on one server.

---

## 10. Multi-currency philosophy

Multi-currency support is a central differentiator of the app.

### Key principle

Budgeting should be done separately per currency.

There should **not** be a single synthetic budget currency for actual budgeting operations, because fluctuations in exchange rate make that conceptually misleading.

### Implications

- accounts have a native currency
- budget categories are currency-specific
- budgeting behavior is tracked separately for each currency
- reporting may convert across currencies for summary and analysis
- native ledger values are never overwritten by reporting conversions

### Reporting rule

Reporting conversions are for summary and analysis only. They must never rewrite or replace native transaction/account values.

---

## 11. Accounts, categories, and currencies

### Accounts

Accounts are where money lives.

Each account has:

- a name
- an account type
- a native currency
- a running balance based on transactions, transfers, reconciliation, and adjustments

### Categories

Categories represent what money is for.

Because budgeting is currency-specific:

- category balances are currency-specific
- conceptually similar categories may exist across currencies, but balances must remain separate

Example:

- Groceries (USD)
- Groceries (KRW)

Whether this appears in the UI as distinct categories or as one category with separate internal currency buckets is an implementation and design question, but the accounting model must keep them separate.

---

## 12. Transaction model

The core transaction types in v1 are:

### 1. Income

Money enters an account and becomes available to assign to categories within that account's currency context.

### 2. Spending transaction

Money leaves an account and should reduce a category balance in the same currency context.

### 3. Transfer between accounts

Money moves from one account to another.

Transfers may be:

- same-currency transfers
- cross-currency transfers

### 4. Adjustment transaction

Used during reconciliation or correction when the recorded balance does not match the actual balance.

---

## 13. Cross-currency transfers

Cross-currency transfers require special handling.

### Requirements

A cross-currency transfer may include:

- amount leaving the source account
- source currency
- amount arriving in the destination account
- destination currency
- effective exchange rate
- optional fee

### Principle

At the end of the day, the most important facts are:

- how much left one account
- how much arrived in the other account
- what fee was paid

The effective exchange rate is useful and should be stored for record-keeping and reporting, but the actual recorded account changes are the source-of-truth ledger events.

### Accounting note

A fee associated with a conversion/transfer should be modeled explicitly rather than hidden inside the exchange rate.

---

## 14. Reconciliation

Reconciliation is part of v1.

### Desired workflow

Similar to older YNAB workflows, the user should:

1. manually enter the current real-world account balance
2. compare that against the app's computed balance
3. if there is a mismatch, review recent transactions
4. either correct missing/incorrect entries or create an adjustment transaction

This is important because v1 will not include bank syncing.

---

## 15. Import system

Import is a first-class feature.

### Why import matters

- manual entry alone is too limiting for many users
- migration from YNAB is a key initial use case
- supporting multiple CSV formats increases practical utility

### v1 import requirements

- CSV import support
- support for YNAB-exported CSVs as an initial target
- support for non-YNAB CSV formats where feasible
- import preview before commit
- a simple mapping interface where users assign CSV columns to app fields
- validation and error handling before import finalization

### Import design principle

The import system should be structured as a pipeline:

1. parse file
2. map columns
3. preview interpreted records
4. validate
5. commit

This will make future import extensions easier.

---

## 16. Reports and visualization

Reporting should be modular, but a simple summary report is essential for v1.

### v1 reporting goals

- useful and intuitive overview
- clear high-level view of balances, budget status, and spending
- support summary across currencies using conversion when requested
- preserve a clear distinction between native values and converted summary values

### Potential v1 report components

- account balances
- category balances
- spending by category
- income vs spending over time
- basic net position summary

### Future reporting extensions

- savings goals
- richer trend analysis
- budget health indicators
- more advanced visualizations

These should be added modularly later.

---

## 17. Backup, export, and data portability

Financial software must prioritize reliability and recoverability.

### v1 requirements

- automated database backups
- CSV export
- JSON export

### Principles

- users should not feel locked into the app
- backup and restore should be considered part of the core system, not an afterthought
- data portability is an important part of the privacy-first philosophy

---

## 18. Non-goals

This app is **not** trying to be:

- a cloud SaaS product in v1
- a public internet finance portal
- a Plaid-style bank aggregation service
- a tax preparation tool
- a full accounting system for businesses
- an investment portfolio platform
- a peer-to-peer offline sync system
- a feature-maximal personal finance suite

The goal is a clean, correct, privacy-first budgeting tool.

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

## 20. Suggested data model concepts

This section is conceptual, not final schema design.

Potential core entities:

- User
- Budget
- Account
- Currency
- Category
- Category balance bucket by currency
- Transaction
- Transfer
- Reconciliation event
- Adjustment transaction
- Exchange-rate record / transfer exchange context
- Import job
- Backup/export metadata

Core conceptual separation:

- **Accounts**: where money lives
- **Categories**: what money is for
- **Transactions**: what happened
- **Transfers**: movement between accounts
- **Currency layer**: native-denominated storage plus optional reporting conversion

---

## 21. Draft data model

This section provides a more concrete conceptual data model for implementation. It is still high-level enough to evolve, but specific enough to guide database schema design, API design, and AI-assisted coding.

### 21.1 Modeling principles

1. **The server database is canonical**\
   All authoritative financial state lives on the server.

2. **Native currency values are always preserved**\
   Account balances, transactions, transfers, and reconciliation records are stored in their native currencies.

3. **Budgeting is currency-specific**\
   Category balances must be tracked separately by currency.

4. **Ledger events are append-oriented**\
   As much as practical, financial state should be derived from explicit records rather than hidden mutable totals.

5. **Reporting conversions are derived views**\
   Converted summaries should come from exchange-rate data and native ledger values, not replace them.

6. **Shared-budget collaboration requires user attribution**\
   Important changes should be attributable to a user, even if v1 audit/history remains lightweight.

---

### 21.2 Core entities

The v1 system should be organized around the following core entities.

#### User

Represents one person with access to the shared budget system.

Suggested fields:

- `id`
- `display_name`
- `email` or other login identifier if needed
- `created_at`
- `updated_at`
- `is_active`
- `last_seen_at`

Notes:

- v1 can keep permissions simple
- all active users collaborate on one shared budget

#### Session / Auth token

Represents persistent login on a trusted device.

Suggested fields:

- `id`
- `user_id`
- `device_label` or `client_name`
- `created_at`
- `expires_at` or long-lived session metadata
- `last_used_at`
- `revoked_at`

Notes:

- exact auth implementation may vary
- this entity may be implicit depending on auth library choice

#### Budget

Represents the shared household budget container.

Suggested fields:

- `id`
- `name`
- `created_at`
- `updated_at`
- `default_reporting_currency_id` nullable
- `is_archived`

Notes:

- v1 likely has exactly one active budget
- schema should still allow future extension to multiple budgets later

#### Budget membership

Links users to the shared budget.

Suggested fields:

- `id`
- `budget_id`
- `user_id`
- `role` (simple role such as owner/member)
- `joined_at`
- `is_active`

Notes:

- v1 can keep roles minimal
- this table helps future-proof collaboration

#### Currency

Represents a supported currency.

Suggested fields:

- `id`
- `code` (USD, KRW, EUR, etc.)
- `name`
- `symbol`
- `decimal_places`
- `is_active`

Notes:

- do not hardcode currency assumptions into the app logic

#### Account

Represents where money lives.

Suggested fields:

- `id`
- `budget_id`
- `name`
- `account_type` (checking, savings, cash, credit-like, etc.)
- `currency_id`
- `is_closed`
- `created_at`
- `updated_at`
- `opening_balance_amount`
- `opening_balance_date`
- `created_by_user_id`

Notes:

- current balance should ideally be derivable from opening balance plus ledger activity
- each account has exactly one native currency

#### Category group

Optional grouping layer for categories.

Suggested fields:

- `id`
- `budget_id`
- `name`
- `sort_order`
- `is_hidden`
- `created_at`
- `updated_at`

Examples:

- Fixed expenses
- Variable spending
- Savings

#### Category

Represents a budgeting envelope concept.

Suggested fields:

- `id`
- `budget_id`
- `category_group_id` nullable
- `name`
- `sort_order`
- `is_hidden`
- `created_at`
- `updated_at`

Important note: A category is a conceptual label such as Groceries or Rent. Because budgeting is currency-specific, actual budget balances must not live directly on the category alone.

#### Category currency bucket

Represents the balance and budgeting state of one category in one currency.

Suggested fields:

- `id`
- `budget_id`
- `category_id`
- `currency_id`
- `created_at`
- `updated_at`

Derived or stored values may include:

- assigned amount for current period
- available amount
- activity amount for current period

Recommended design note: Instead of storing mutable summary totals here as authoritative truth, consider deriving these values from budgeting and transaction tables where practical, or storing cached totals with careful invariants.

This entity is essential because category balances are currency-specific.

#### Budget period

Represents a budgeting interval, likely monthly.

Suggested fields:

- `id`
- `budget_id`
- `period_start_date`
- `period_end_date`
- `label`
- `created_at`
- `updated_at`
- `is_closed`

Notes:

- v1 likely uses monthly periods
- this gives structure to assigned amounts and reporting

#### Budget assignment

Represents assigning money to a category bucket for a given period.

Suggested fields:

- `id`
- `budget_id`
- `budget_period_id`
- `category_id`
- `currency_id`
- `amount`
- `assigned_by_user_id`
- `created_at`
- `updated_at`
- `memo` nullable

Notes:

- this is one of the key tables for envelope budgeting
- category assignment should be currency-specific
- reassignments may be modeled as updates or as append-only delta rows depending on implementation preference

Recommended approach: Prefer modeling assignment changes as explicit delta events if you want stronger history/audit later. For a simpler v1, a single current assigned amount per category/currency/period may be acceptable if revisions are tracked elsewhere.

#### Payee

Optional normalization for transaction counterparties.

Suggested fields:

- `id`
- `budget_id`
- `name`
- `created_at`
- `updated_at`
- `is_hidden`

Notes:

- not strictly required for v1, but useful for imports and clean transaction entry

#### Transaction

Represents a ledger event on one account.

Suggested fields:

- `id`
- `budget_id`
- `account_id`
- `transaction_date`
- `posted_date` nullable
- `amount`
- `currency_id`
- `transaction_type` (income, expense, adjustment, transfer\_component, etc.)
- `payee_id` nullable
- `payee_name_raw` nullable
- `memo` nullable
- `created_by_user_id`
- `created_at`
- `updated_at`
- `import_job_id` nullable
- `external_import_key` nullable
- `is_deleted` or soft-delete metadata if needed

Notes:

- sign convention should be decided early and documented clearly
- `currency_id` should usually match the account currency
- transactions should remain immutable where practical except for controlled edits

#### Transaction category split

Represents allocation of a transaction across one or more categories.

Suggested fields:

- `id`
- `transaction_id`
- `category_id`
- `currency_id`
- `amount`
- `created_at`
- `updated_at`

Notes:

- allows split transactions
- category allocation remains currency-specific
- for simple uncategorized transactions, there would be one split row

#### Transfer

Represents a logical transfer linking ledger activity across two accounts.

Suggested fields:

- `id`
- `budget_id`
- `source_account_id`
- `destination_account_id`
- `transfer_date`
- `created_by_user_id`
- `created_at`
- `updated_at`
- `memo` nullable
- `transfer_kind` (same\_currency, cross\_currency)

Notes:

- a transfer should not merely be inferred from two unrelated transactions
- it should explicitly link the two sides of the movement

#### Transfer leg

Represents one side of a transfer.

Suggested fields:

- `id`
- `transfer_id`
- `account_id`
- `transaction_id`
- `leg_direction` (outflow, inflow)
- `amount`
- `currency_id`

Notes:

- useful for cleanly modeling same-currency and cross-currency transfers
- helps associate normal transaction rows with one logical transfer

#### Transfer exchange detail

Represents exchange-rate and fee information for a cross-currency transfer.

Suggested fields:

- `id`
- `transfer_id`
- `source_amount`
- `source_currency_id`
- `destination_amount`
- `destination_currency_id`
- `effective_exchange_rate`
- `fee_amount` nullable
- `fee_currency_id` nullable
- `fee_category_id` nullable
- `notes` nullable
- `created_at`
- `updated_at`

Notes:

- this table should only be used when the transfer crosses currencies or includes fee metadata
- the real source-of-truth remains the actual transfer legs and transaction records
- the exchange detail is structured context, not a replacement for ledger amounts

#### Reconciliation event

Represents a reconciliation attempt or completed reconciliation for one account.

Suggested fields:

- `id`
- `budget_id`
- `account_id`
- `reconciled_by_user_id`
- `statement_balance`
- `statement_date`
- `computed_balance_at_time`
- `difference_amount`
- `status` (matched, mismatch\_reviewed, adjusted)
- `adjustment_transaction_id` nullable
- `created_at`
- `updated_at`
- `notes` nullable

Notes:

- this supports the YNAB-like workflow where users compare the real balance against the app balance

#### Exchange rate record

Represents exchange-rate data used for reporting or manual conversion references.

Suggested fields:

- `id`
- `base_currency_id`
- `quote_currency_id`
- `rate`
- `rate_date`
- `source_type` (manual, api, transfer\_implied)
- `source_reference` nullable
- `created_at`

Notes:

- reporting conversions should use data from here or derived equivalents
- transfer-specific rates should still be preserved at the transfer level

#### Import job

Represents one file import workflow.

Suggested fields:

- `id`
- `budget_id`
- `uploaded_by_user_id`
- `source_type` (ynab\_csv, generic\_csv, etc.)
- `original_filename`
- `created_at`
- `updated_at`
- `status` (uploaded, mapped, previewed, validated, committed, failed)
- `raw_file_path` or blob reference
- `mapping_config_json`
- `validation_summary_json`
- `import_summary_json`

Notes:

- import jobs should be explicit entities for traceability

#### Imported row staging record

Optional staging table for parsed import rows before commit.

Suggested fields:

- `id`
- `import_job_id`
- `row_index`
- `raw_row_json`
- `parsed_row_json`
- `validation_status`
- `validation_errors_json`
- `matched_account_id` nullable
- `matched_category_id` nullable
- `matched_payee_id` nullable
- `proposed_transaction_date` nullable
- `proposed_amount` nullable

Notes:

- very useful for import previews and debugging

#### Backup record

Represents metadata about a generated backup/export.

Suggested fields:

- `id`
- `budget_id` nullable
- `created_at`
- `created_by_user_id` nullable
- `backup_type` (database, csv\_export, json\_export)
- `storage_path` or reference
- `status`
- `notes` nullable

---

### 21.3 Relationship summary

Key relationships:

- one `Budget` has many `Users` through `Budget membership`
- one `Budget` has many `Accounts`
- one `Budget` has many `Category groups`
- one `Category group` has many `Categories`
- one `Category` has many `Category currency buckets`
- one `Budget` has many `Budget periods`
- one `Budget period` has many `Budget assignments`
- one `Account` has many `Transactions`
- one `Transaction` may have many `Transaction category splits`
- one `Transfer` connects two accounts through two `Transfer legs`
- one `Transfer` may have one `Transfer exchange detail`
- one `Account` has many `Reconciliation events`
- one `Budget` has many `Import jobs`
- one `Import job` may produce many `Transactions`

---

### 21.4 Invariants and business rules

These are important logical rules the schema and service layer should enforce.

#### Currency invariants

1. Every account has exactly one native currency.
2. A transaction recorded on an account should normally have the same currency as the account.
3. Category budgeting is currency-specific.
4. Reporting conversions never alter stored native amounts.

#### Budgeting invariants

5. Money available to assign should be computed within each currency separately.
6. A spending transaction should reduce category availability in the matching currency context.
7. Budget assignments cannot create money; they only allocate available money within a currency pool.

#### Transfer invariants

8. Every logical transfer should explicitly link its two sides.
9. Same-currency transfers should preserve value exactly apart from any explicit fee.
10. Cross-currency transfers should preserve both native amounts and any explicit exchange/fee metadata.
11. Fees should be represented explicitly, not hidden inside a synthetic rate.

#### Reconciliation invariants

12. Reconciliation compares a user-entered real balance against computed ledger balance.
13. Any reconciliation adjustment should be represented by an explicit adjustment transaction.

#### Collaboration invariants

14. Important records should retain `created_by_user_id` or equivalent user attribution.
15. Deletion should be handled carefully; soft-delete or audit-safe approaches may be preferable for financial records.

---

### 21.5 Derived values

The following values should generally be treated as derived or cacheable summaries rather than primary truth:

- current account balance
- total available-to-assign per currency
- category available amount
- category activity for a period
- reporting-currency summaries
- monthly spending summaries

Design recommendation: Keep the canonical ledger and assignment records clean, and derive summaries from them. Introduce cached/materialized summaries only when performance actually requires them.

---

### 21.6 Sign conventions

This should be decided very early and documented consistently.

One possible convention:

- positive amount = inflow to the account
- negative amount = outflow from the account

Alternative conventions are possible, but the important thing is consistency across:

- transactions
- transfer legs
- reconciliation adjustments
- imports
- reporting logic

This choice should be fixed before implementation proceeds far.

---

### 21.7 Minimal v1 schema slice

If the goal is to implement the smallest usable backbone first, the minimum useful schema likely includes:

- User
- Session/Auth
- Budget
- Budget membership
- Currency
- Account
- Category group
- Category
- Budget period
- Budget assignment
- Transaction
- Transaction category split
- Transfer
- Transfer leg
- Transfer exchange detail
- Reconciliation event
- Import job

Entities like Payee, Exchange rate record, Imported row staging record, and Backup record are still strongly recommended, but some could be deferred slightly if necessary.

---

### 21.8 Suggested implementation order

1. Users, budget, membership
2. Currencies and accounts
3. Categories and category groups
4. Budget periods and budget assignments
5. Transactions and category splits
6. Transfers and transfer legs
7. Cross-currency transfer exchange details
8. Reconciliation events
9. Import jobs and import staging
10. Reporting/exchange-rate support

---

### 21.9 Questions to settle during schema design

1. Should budget assignment history be stored as mutable current values or append-only delta events?
2. Should category currency buckets be explicit rows or derived implicitly from category plus assignment/transaction activity?
3. Should transactions be fully immutable with reversal/edit records, or editable with audit metadata in v1?
4. How aggressively should soft-delete be used for financial records?
5. How much audit/history is necessary in the first implementation for a multi-user shared budget?

---

## 22. Concrete schema draft

This section translates the conceptual data model into a more implementation-ready relational schema for PostgreSQL. It is still a draft, but it is intended to be specific enough to guide migrations, ORM models, and backend service design.

### 22.1 Recommended decisions for open modeling questions

Before defining tables, the following implementation choices are recommended for v1.

#### 1. Budget assignment history

Use **append-only delta events** rather than only storing one mutable assigned amount.

Rationale:

- better auditability in a multi-user shared budget
- easier to reconstruct history
- conceptually aligned with ledger-style systems

Practical note:

- summary totals can still be cached or materialized for performance later

#### 2. Category currency buckets

Use **explicit rows** for category/currency combinations.

Rationale:

- cleaner constraints
- easier querying
- simpler service-layer logic
- clearer support for zero-balance but active category/currency pairs

#### 3. Transaction editing model

Allow **controlled edits in v1**, but preserve audit metadata.

Rationale:

- easier UX for early versions
- lower implementation overhead than full immutable reversal-only editing

Recommended safeguard:

- keep `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`
- avoid hard deletion for financial records

#### 4. Deletion strategy

Use **soft delete sparingly**.

Recommended rule:

- transactions, transfers, reconciliation-related records, and assignment events should generally not be hard-deleted
- prefer `archived` / `voided` / `deleted_at` style metadata where necessary
- reference tables like payees or categories can support hidden/archive semantics

#### 5. Audit/history scope for v1

Implement **lightweight auditability**, not a full event-sourcing system.

Recommended minimum:

- user attribution fields on important records
- timestamps on all user-created financial records
- append-only assignment events
- explicit reconciliation events

---

### 22.2 PostgreSQL conventions

Recommended conventions:

- primary keys: UUID
- timestamps: `timestamptz`
- monetary amounts: `numeric(20, 6)` or similar high-precision fixed-point numeric type
- currency codes: ISO-style text code, but normalized through a currency table
- avoid floating-point types for money and exchange rates

Recommended global fields on most tables:

- `id uuid primary key`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` where records are mutable

Recommended indexing principles:

- index all foreign keys
- index common filtering dimensions like `budget_id`, `account_id`, `transaction_date`, `currency_id`
- use unique constraints where they express real business rules

---

### 22.3 Core tables

#### `users`

Represents a person with access to the system.

Suggested columns:

- `id uuid primary key`
- `display_name text not null`
- `email text unique null`
- `is_active boolean not null default true`
- `last_seen_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- email may be optional depending on auth method
- if Tailscale identity is later integrated, additional identity fields may be added

#### `sessions`

Represents persistent auth/session state.

Suggested columns:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `device_label text null`
- `session_token_hash text not null`
- `expires_at timestamptz null`
- `last_used_at timestamptz null`
- `revoked_at timestamptz null`
- `created_at timestamptz not null default now()`

Recommended indexes:

- index on `user_id`
- unique constraint on `session_token_hash`

#### `budgets`

Represents the shared household budget container.

Suggested columns:

- `id uuid primary key`
- `name text not null`
- `default_reporting_currency_id uuid null references currencies(id)`
- `is_archived boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### `budget_memberships`

Links users to budgets.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `user_id uuid not null references users(id)`
- `role text not null default 'member'`
- `is_active boolean not null default true`
- `joined_at timestamptz not null default now()`

Constraints:

- unique (`budget_id`, `user_id`)

Note:

- for v1, roles can remain simple: `owner`, `member`

#### `currencies`

Supported currencies.

Suggested columns:

- `id uuid primary key`
- `code text not null unique`
- `name text not null`
- `symbol text not null`
- `decimal_places integer not null default 2`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Constraint ideas:

- check `decimal_places >= 0`

#### `accounts`

Financial containers where money lives.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `name text not null`
- `account_type text not null`
- `currency_id uuid not null references currencies(id)`
- `opening_balance_amount numeric(20,6) not null default 0`
- `opening_balance_date date not null`
- `is_closed boolean not null default false`
- `created_by_user_id uuid null references users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended indexes:

- index on `budget_id`
- index on `currency_id`

Constraint ideas:

- unique (`budget_id`, `name`) if account names must be unique within a budget

#### `category_groups`

Optional UI/logical grouping of categories.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `name text not null`
- `sort_order integer not null default 0`
- `is_hidden boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint ideas:

- unique (`budget_id`, `name`)

#### `categories`

Conceptual budgeting categories.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `category_group_id uuid null references category_groups(id)`
- `name text not null`
- `sort_order integer not null default 0`
- `is_hidden boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint ideas:

- unique (`budget_id`, `name`)

#### `category_currency_buckets`

Explicit currency-specific budgeting bucket for a category.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `category_id uuid not null references categories(id)`
- `currency_id uuid not null references currencies(id)`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique (`category_id`, `currency_id`)

Recommended note:

- this table defines valid category/currency budgeting combinations
- summary balances should still be derived from assignments and spending activity

#### `budget_periods`

Budgeting intervals, likely monthly.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `period_start_date date not null`
- `period_end_date date not null`
- `label text not null`
- `is_closed boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique (`budget_id`, `period_start_date`, `period_end_date`)
- check `period_end_date >= period_start_date`

#### `budget_assignment_events`

Append-only budgeting allocation and reallocation events.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `budget_period_id uuid not null references budget_periods(id)`
- `category_currency_bucket_id uuid not null references category_currency_buckets(id)`
- `amount_delta numeric(20,6) not null`
- `event_type text not null`
- `memo text null`
- `created_by_user_id uuid null references users(id)`
- `created_at timestamptz not null default now()`

Notes:

- `amount_delta` may be positive or negative
- examples of `event_type`: `assign`, `unassign`, `move_in`, `move_out`, `carryover_adjustment`

Recommended indexes:

- index on `budget_period_id`
- index on `category_currency_bucket_id`
- index on `budget_id`

#### `payees`

Normalized transaction counterparties.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `name text not null`
- `is_hidden boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint ideas:

- unique (`budget_id`, `name`)

---

### 22.4 Ledger and transaction tables

#### `transactions`

Core ledger table. Each row belongs to exactly one account.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `account_id uuid not null references accounts(id)`
- `transaction_date date not null`
- `posted_date date null`
- `amount numeric(20,6) not null`
- `currency_id uuid not null references currencies(id)`
- `transaction_type text not null`
- `status text not null default 'posted'`
- `payee_id uuid null references payees(id)`
- `payee_name_raw text null`
- `memo text null`
- `import_job_id uuid null references import_jobs(id)`
- `external_import_key text null`
- `created_by_user_id uuid null references users(id)`
- `updated_by_user_id uuid null references users(id)`
- `deleted_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended constraints:

- check `amount <> 0`
- check that `transaction_type` is in an allowed set

Recommended indexes:

- index on `account_id`
- index on `budget_id`
- index on `transaction_date`
- index on (`account_id`, `transaction_date`)
- index on `import_job_id`

Recommended design notes:

- use a consistent sign convention, for example positive = inflow, negative = outflow
- `currency_id` should match the account currency in normal cases
- `deleted_at` is preferable to hard-delete for financial safety

#### `transaction_splits`

Category allocation rows for each transaction.

Suggested columns:

- `id uuid primary key`
- `transaction_id uuid not null references transactions(id)`
- `category_currency_bucket_id uuid not null references category_currency_buckets(id)`
- `amount numeric(20,6) not null`
- `memo text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- check `amount <> 0`

Recommended design rule:

- the sum of split amounts should match the transaction amount for categorized expense/income transactions, subject to clearly defined exceptions such as uncategorized inflow staging if that is ever allowed

Recommended implementation note:

- enforcing split sums may be done in application logic first, then strengthened with database constraints or triggers later if needed

---

### 22.5 Transfer tables

#### `transfers`

Logical transfer object linking movement between two accounts.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `source_account_id uuid not null references accounts(id)`
- `destination_account_id uuid not null references accounts(id)`
- `transfer_date date not null`
- `transfer_kind text not null`
- `memo text null`
- `created_by_user_id uuid null references users(id)`
- `updated_by_user_id uuid null references users(id)`
- `deleted_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- check `source_account_id <> destination_account_id`
- check `transfer_kind in ('same_currency','cross_currency')`

#### `transfer_legs`

Links transfer object to ledger transactions.

Suggested columns:

- `id uuid primary key`
- `transfer_id uuid not null references transfers(id)`
- `transaction_id uuid not null references transactions(id)`
- `account_id uuid not null references accounts(id)`
- `leg_direction text not null`
- `amount numeric(20,6) not null`
- `currency_id uuid not null references currencies(id)`
- `created_at timestamptz not null default now()`

Constraints:

- unique (`transaction_id`)
- check `leg_direction in ('outflow','inflow')`
- check `amount <> 0`

Recommended business rule:

- each transfer should have exactly two primary legs: one outflow, one inflow

#### `transfer_exchange_details`

Extra structured metadata for cross-currency transfer context.

Suggested columns:

- `id uuid primary key`
- `transfer_id uuid not null unique references transfers(id)`
- `source_amount numeric(20,6) not null`
- `source_currency_id uuid not null references currencies(id)`
- `destination_amount numeric(20,6) not null`
- `destination_currency_id uuid not null references currencies(id)`
- `effective_exchange_rate numeric(20,10) null`
- `fee_amount numeric(20,6) null`
- `fee_currency_id uuid null references currencies(id)`
- `fee_category_currency_bucket_id uuid null references category_currency_buckets(id)`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint ideas:

- check `source_amount > 0`
- check `destination_amount > 0`
- check `fee_amount is null or fee_amount >= 0`

Design note:

- the fee itself may also need to correspond to an explicit ledger transaction or split, depending on how transfer-fee UX is implemented
- this table should be treated as structured context, not the primary ledger

---

### 22.6 Reconciliation tables

#### `reconciliation_events`

Captures a reconciliation action for one account.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `account_id uuid not null references accounts(id)`
- `statement_date date not null`
- `statement_balance numeric(20,6) not null`
- `computed_balance_at_time numeric(20,6) not null`
- `difference_amount numeric(20,6) not null`
- `status text not null`
- `adjustment_transaction_id uuid null references transactions(id)`
- `notes text null`
- `reconciled_by_user_id uuid null references users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- check `status in ('matched','mismatch_reviewed','adjusted')`

Recommended note:

- adjustment should only occur through an explicit transaction row, never as a hidden balance rewrite

---

### 22.7 Exchange-rate and reporting tables

#### `exchange_rate_records`

Stores exchange rates used for reporting or manual reference.

Suggested columns:

- `id uuid primary key`
- `base_currency_id uuid not null references currencies(id)`
- `quote_currency_id uuid not null references currencies(id)`
- `rate numeric(20,10) not null`
- `rate_date date not null`
- `source_type text not null`
- `source_reference text null`
- `created_at timestamptz not null default now()`

Constraints:

- unique (`base_currency_id`, `quote_currency_id`, `rate_date`, `source_type`)
- check `rate > 0`
- check `base_currency_id <> quote_currency_id`

Notes:

- this is for reporting/analysis, not native ledger storage
- support both manually entered and API-derived rates in the future

---

### 22.8 Import and migration tables

#### `import_jobs`

Tracks one import workflow from upload to commit.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid not null references budgets(id)`
- `uploaded_by_user_id uuid null references users(id)`
- `source_type text not null`
- `original_filename text not null`
- `status text not null`
- `raw_file_path text null`
- `mapping_config_json jsonb null`
- `validation_summary_json jsonb null`
- `import_summary_json jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- check `status in ('uploaded','mapped','previewed','validated','committed','failed')`

#### `import_staging_rows`

Optional parsed row staging table.

Suggested columns:

- `id uuid primary key`
- `import_job_id uuid not null references import_jobs(id)`
- `row_index integer not null`
- `raw_row_json jsonb not null`
- `parsed_row_json jsonb null`
- `validation_status text not null`
- `validation_errors_json jsonb null`
- `matched_account_id uuid null references accounts(id)`
- `matched_category_id uuid null references categories(id)`
- `matched_payee_id uuid null references payees(id)`
- `proposed_transaction_date date null`
- `proposed_amount numeric(20,6) null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique (`import_job_id`, `row_index`)

Notes:

- especially useful for preview, validation, and debugging during migration from YNAB or other formats

---

### 22.9 Backup/export metadata

#### `backup_records`

Tracks generated backups and exports.

Suggested columns:

- `id uuid primary key`
- `budget_id uuid null references budgets(id)`
- `created_by_user_id uuid null references users(id)`
- `backup_type text not null`
- `storage_path text not null`
- `status text not null`
- `notes text null`
- `created_at timestamptz not null default now()`

Constraints:

- check `backup_type in ('database','csv_export','json_export')`

---

### 22.10 Derived views and service-layer computations

The following should generally be derived in queries or service-layer logic rather than stored as primary truth:

- current account balance
- available-to-assign per currency
- category available balance per period and currency
- category activity per period and currency
- reporting-currency summaries
- dashboard totals

Potential future optimization:

- database views
- materialized views
- cached summary tables refreshed by background jobs or write-through logic

Do not build these caches until query performance actually requires them.

---

### 22.11 Recommended database-level safeguards

Useful safeguards to add early:

1. Foreign keys on all relational links
2. Unique constraints for category/currency buckets
3. Check constraints for status/type enums where practical
4. Nonzero-amount checks on transactions, splits, and transfer legs
5. Soft-delete rather than hard-delete for core financial records

Safeguards that may come slightly later:

6. Triggers to keep `updated_at` current
7. Triggers or deferred constraints for transaction split sum validation
8. Triggers enforcing transaction currency = account currency
9. Views for computed balances and budget summaries

---

### 22.12 Suggested implementation notes for ORM and migrations

- keep enum-like fields as text plus application validation in early iterations unless native PostgreSQL enums clearly improve maintainability
- use UUID generation at the database or application layer consistently
- keep migration files small and focused
- seed currency definitions early
- treat import/migration tooling as part of the core product, not a side utility

---

### 22.13 First-pass schema build order

Recommended migration order:

1. currencies
2. users
3. sessions
4. budgets
5. budget\_memberships
6. accounts
7. category\_groups
8. categories
9. category\_currency\_buckets
10. budget\_periods
11. budget\_assignment\_events
12. payees
13. import\_jobs
14. transactions
15. transaction\_splits
16. transfers
17. transfer\_legs
18. transfer\_exchange\_details
19. reconciliation\_events
20. exchange\_rate\_records
21. import\_staging\_rows
22. backup\_records

---

### 22.14 Remaining schema-level questions

1. Should fees attached to cross-currency transfers always generate their own transaction row, or only when the UX explicitly exposes them as separate spending events?
2. Should import-generated transactions be marked immutable until confirmed, or simply be normal editable transactions after commit?
3. Should the system support uncategorized inflow staging, or require immediate categorization semantics consistent with strict YNAB-like behavior?
4. Should category names be globally unique per budget, or should the UI eventually allow duplicate display names under different groups?

---

## 23. API and service-layer draft

This section describes the behavioral contract between the UI and the backend. It is not just a list of CRUD endpoints. It defines the core domain operations, validations, invariants, transaction boundaries, and read models that the application should implement.

The goal is to make the backend reflect the budgeting model rather than simply exposing raw tables.

---

### 23.1 Service-layer principles

1. **Server-side domain logic is authoritative**\
   The client should not be trusted to enforce accounting or budgeting invariants.

2. **Financial writes must be atomic**\
   Any operation that creates or modifies multiple related records should succeed or fail as one database transaction.

3. **Native currency values are the source of truth**\
   All service logic must preserve native-denominated ledger data.

4. **Derived summaries are computed after writes**\
   The service layer should return refreshed summaries for the affected entities, but it should not rely on mutable stored balances as primary truth.

5. **Budgeting is enforced per currency**\
   Service methods must prevent category assignment or spending logic from crossing currency boundaries improperly.

6. **Transfers are first-class operations**\
   Transfer creation should not be modeled as two unrelated transactions stitched together by the client.

7. **Import is a staged workflow**\
   Parsing, mapping, preview, validation, and commit should be distinct backend-supported steps.

8. **Multi-user edits should be attributable**\
   Important service actions should record user attribution and timestamps.

---

### 23.2 API style recommendation

For v1, prefer a pragmatic HTTP JSON API organized around domain workflows.

A reasonable structure would be:

- `GET` endpoints for read models and lists
- `POST` endpoints for domain commands that create or apply actions
- `PATCH` endpoints for controlled edits to mutable records
- `DELETE` used sparingly, with soft-delete semantics where appropriate

Alternative patterns such as RPC-style route handlers are also acceptable if the domain operations remain clear.

The important thing is that the API should expose meaningful actions such as `create transfer` or `reconcile account`, not just raw table CRUD.

---

### 23.3 Error model

The backend should return structured errors with a stable shape.

Suggested error categories:

- `validation_error`
- `not_found`
- `conflict`
- `unauthorized`
- `forbidden`
- `invariant_violation`
- `import_error`
- `internal_error`

Suggested error response shape:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Category bucket currency does not match account currency.",
    "details": {
      "field": "category_currency_bucket_id"
    }
  }
}
```

---

### 23.4 Authentication and request context

Each authenticated request should carry enough context for the backend to determine:

- acting user
- active budget
- device/session if relevant

The service layer should consistently enforce:

- user is an active member of the budget
- user session is valid
- budget-scoped records actually belong to the active budget

---

### 23.5 Core command operations

These are the major write-side behaviors the backend should support.

#### 1. Create account

Purpose: Create a new account in a specific currency.

Input:

- account name
- account type
- currency
- opening balance
- opening balance date

Validation:

- account name valid within budget
- currency exists and is active
- opening balance date present

Effects:

- create `accounts` row
- optionally create bootstrap transactions later if opening-balance handling is implemented that way

Response should include:

- created account
- derived current balance

#### 2. Create category and category currency bucket

Purpose: Create a conceptual category and enable budgeting for one or more currencies.

Input:

- category name
- category group
- one or more currencies to activate

Validation:

- category name valid within budget
- category group belongs to active budget
- currencies exist

Effects:

- create `categories` row
- create one or more `category_currency_buckets`

Response should include:

- created category
- bucket metadata

#### 3. Create budget period

Purpose: Create the budgeting interval for a month or other period.

Validation:

- no overlapping duplicate period for same budget
- valid period dates

Effects:

- create `budget_periods` row

#### 4. Assign money to category

Purpose: Allocate money to a category bucket for a given period.

Input:

- budget period
- category currency bucket
- amount delta
- memo optional

Validation:

- period belongs to budget and is open
- category currency bucket belongs to budget
- available-to-assign in that currency is sufficient for negative impact on unassigned pool
- amount not zero

Effects:

- create `budget_assignment_events` row

Response should include:

- created assignment event
- updated available-to-assign for that currency
- updated category period summary

#### 5. Move money between categories

Purpose: Reallocate budgeted money within the same currency.

Input:

- source category bucket
- destination category bucket
- budget period
- amount
- memo optional

Validation:

- source and destination buckets belong to same budget period context
- both buckets use the same currency
- source category has sufficient available amount according to chosen movement rule
- amount positive

Effects:

- create two `budget_assignment_events` rows in one transaction:
  - negative event on source bucket
  - positive event on destination bucket

Response should include:

- updated summaries for both categories
- updated available-to-assign if applicable

#### 6. Record income transaction

Purpose: Record money entering an account.

Input:

- account
- date
- amount
- payee optional
- memo optional
- category treatment for income flow

Validation:

- account belongs to budget
- amount sign and transaction type consistent
- transaction currency matches account currency

Effects:

- create `transactions` row
- possibly create transaction split logic depending on how income is modeled
- increase available-to-assign in that currency in derived calculations

Income handling in v1:

- income may be categorized as income/unassigned money for that currency, in which case it increases ready-to-assign for that currency
- income may also be assigned directly to a specific budget category at entry, which is useful for reimbursements and similar cases

Recommended implementation note:

- treat direct-to-category income as an allowed special case rather than forcing all inflows through unassigned money first

#### 7. Record spending transaction

Purpose: Record money leaving an account and consuming category budget.

Input:

- account
- date
- amount
- one or more category splits
- payee
- memo optional

Validation:

- account belongs to budget
- transaction currency matches account currency
- each split bucket matches the same currency
- split totals equal transaction amount according to sign convention
- optionally warn or block if category available amount would go negative, depending on overdraft policy

Effects:

- create `transactions` row
- create one or more `transaction_splits` rows

Response should include:

- created transaction
- updated account summary
- updated category summaries

Overspending behavior in v1:

- account balances may go negative where appropriate, such as for credit-type accounts
- category overspending should not block transaction entry
- category overspending should be surfaced clearly in the budget UI, for example in red
- users may move money into an overspent category to cover it
- default month rollover behavior should subtract uncovered overspending from the next month's budget
- there should also be an option to carry the negative category balance forward explicitly so it can be paid off in a later month

Recommended implementation note:

- this behavior should be modeled explicitly at period rollover rather than hidden inside display-only logic

#### 8. Edit transaction

Purpose: Allow controlled correction of an existing transaction.

Validation:

- transaction exists and is editable
- any new splits remain valid
- linked transfer transactions may need special restrictions

Effects:

- update transaction row
- replace or update split rows atomically
- update `updated_by_user_id`, `updated_at`

Response should include:

- updated transaction
- refreshed affected summaries

Transfer-linked transaction behavior:

- transactions that are part of a transfer should be edited only through transfer-specific APIs, not through the generic transaction edit flow

Why this matters:

- a transfer is really one logical operation with two linked sides
- editing only one side through the normal transaction editor could break consistency between the source account, destination account, transfer legs, exchange metadata, and any transfer fee records

Example:

- if a USD to KRW transfer created one USD outflow, one KRW inflow, and fee metadata, editing just the USD-side transaction by itself could leave the linked KRW side inconsistent
- therefore, transfer edits should go through transfer-aware backend logic that updates all related records together

#### 9. Create same-currency transfer

Purpose: Move money between two accounts of the same currency.

Input:

- source account
- destination account
- amount
- date
- memo optional

Validation:

- accounts belong to same budget
- accounts use same currency
- source and destination differ
- amount positive

Effects in one database transaction:

- create `transfers` row
- create outflow transaction on source account
- create inflow transaction on destination account
- create two `transfer_legs`

Response should include:

- created transfer
- updated summaries for both accounts

#### 10. Create cross-currency transfer

Purpose: Move money across accounts with different currencies, preserving actual native amounts and fee metadata.

Input:

- source account
- destination account
- source amount
- destination amount
- date
- fee amount optional
- fee currency optional
- fee category optional
- effective exchange rate optional or auto-derived
- memo optional

Validation:

- accounts belong to same budget
- accounts use different currencies
- source amount and destination amount positive
- fee metadata internally consistent
- fee category bucket, if provided, matches fee currency

Effects in one database transaction:

- create `transfers` row with `transfer_kind = cross_currency`
- create source outflow transaction
- create destination inflow transaction
- create two `transfer_legs`
- create `transfer_exchange_details`
- if fee is represented explicitly in the ledger, create fee transaction or transaction split as appropriate

Response should include:

- transfer object
- exchange detail
- any fee record created
- updated source/destination account summaries

Transfer fee behavior in v1:

- every transfer fee that affects balances should exist explicitly in the ledger
- transfer metadata alone is not sufficient for correct accounting

#### 11. Reconcile account

Purpose: Compare account ledger balance with real-world account balance and optionally create an adjustment.

Input:

- account
- statement date
- statement balance
- optional note
- whether to create adjustment if mismatch exists

Validation:

- account belongs to budget
- statement balance valid numeric amount

Effects:

- compute ledger balance as of statement date or current point, depending on reconciliation design
- create `reconciliation_events` row
- if user chooses adjustment and mismatch exists, create adjustment transaction atomically and link it

Response should include:

- reconciliation event
- mismatch amount
- linked adjustment transaction if created

Reconciliation behavior in v1:

- reconciliation should use current-balance reconciliation only in the initial implementation
- more detailed historical statement-date cutoff logic can be added later if needed

#### 12. Archive or hide category/account

Purpose: Remove inactive records from normal workflows without deleting financial history.

Validation:

- record belongs to budget
- archiving does not violate active workflow assumptions

Effects:

- set `is_hidden`, `is_closed`, or similar metadata
- no historical transactions are removed

#### 13. Upload import file

Purpose: Start import workflow.

Input:

- file
- source type guess or selection

Effects:

- create `import_jobs` row
- store raw file
- parse into staging rows if applicable

Response should include:

- import job id
- initial parsing summary

#### 14. Configure import mapping

Purpose: Map source CSV columns to internal fields.

Input:

- import job id
- mapping configuration

Validation:

- required fields mapped
- field types coherent

Effects:

- update `mapping_config_json`
- generate parsed preview and validation output

Response should include:

- preview rows
- validation warnings/errors

#### 15. Commit import job

Purpose: Turn validated staged rows into actual transactions and related records.

Validation:

- import job belongs to budget
- validation passed or user explicitly accepted warnings
- duplicate detection rules applied

Effects in one transaction or carefully chunked transaction model:

- create transactions
- create splits/payees as needed
- update import job status

Response should include:

- import summary
- created record counts
- any skipped rows

Duplicate-detection behavior in v1:

- duplicate detection should be advisory by default
- the UI should surface likely duplicates clearly, but the user should retain control over whether to proceed

---

### 23.6 Core read/query operations

These are the main read models the frontend will need.

#### 1. Budget dashboard

Returns:

- current budget period
- available-to-assign by currency
- top-level account summaries
- category summary cards
- spending/income snapshots
- optional reporting-currency summary

#### 2. Account list and account detail

Returns:

- list of accounts with derived balances
- account detail with transaction history
- filter by date range, payee, category, import source, reconciliation status

#### 3. Category budget view

Returns:

- categories grouped by category group
- per-category per-currency available amount
- assigned amount in selected period
- activity amount in selected period
- overspent state if applicable

#### 4. Transaction list

Returns:

- ledger transactions with joins to payees, categories, transfer metadata
- support for pagination and filtering

#### 5. Reconciliation preview

Returns:

- computed account balance
- recent transactions
- prior reconciliation history for the account
- difference against proposed statement balance if provided

#### 6. Import preview

Returns:

- parsed rows
- validation status per row
- mapping configuration
- warnings and likely duplicates

#### 7. Reporting summary

Returns:

- income/spending trends
- category spending summaries
- account distribution
- cross-currency summary in optional selected reporting currency
- clear labeling of converted vs native values

---

### 23.7 Command transaction boundaries

The following operations should be database-transactional and atomic:

- create/edit spending transaction with splits
- create same-currency transfer
- create cross-currency transfer
- create reconciliation adjustment
- move money between categories
- commit import rows into real transactions, at least in coherent chunks

Rule: No partially completed financial operation should be visible as committed state.

---

### 23.8 Concurrency and sync behavior

In a multi-user shared budget, simultaneous edits may happen.

Recommended v1 behavior:

- latest committed server state is canonical
- mutation responses should return refreshed affected summaries
- the client should refetch or update optimistic state after successful writes
- use lightweight conflict handling first rather than elaborate collaborative merge logic

Potential mechanisms:

- `updated_at` checks for optimistic concurrency on editable rows
- server-sent events or websocket notifications later for live updates

Imported-transaction behavior after commit:

- imported transactions should behave like normal editable transactions after commit
- import provenance should remain visible for traceability

---

### 23.11 Suggested endpoint groups

A reasonable first API grouping might be:

- `/api/auth/*`
- `/api/budget/*`
- `/api/accounts/*`
- `/api/categories/*`
- `/api/assignments/*`
- `/api/transactions/*`
- `/api/transfers/*`
- `/api/reconciliation/*`
- `/api/imports/*`
- `/api/reports/*`
- `/api/settings/*`

Example command endpoints:

- `POST /api/accounts`
- `POST /api/categories`
- `POST /api/assignments`
- `POST /api/assignments/move`
- `POST /api/transactions/income`
- `POST /api/transactions/expense`
- `PATCH /api/transactions/{id}`
- `POST /api/transfers/same-currency`
- `POST /api/transfers/cross-currency`
- `POST /api/reconciliation`
- `POST /api/imports/upload`
- `POST /api/imports/{id}/mapping`
- `POST /api/imports/{id}/commit`

These are examples rather than locked decisions.

---

### 23.12 Suggested service-layer modules

Even if the API is implemented in one application, the domain logic should likely be separated into modules such as:

- auth service
- budget service
- account service
- category service
- assignment service
- transaction service
- transfer service
- reconciliation service
- import service
- reporting service

This will make the codebase easier to reason about and will help AI-assisted coding stay structured.

---

### 23.13 Confirmed behavioral decisions

The following behavioral decisions are now settled for v1:

1. Income may either:
   - increase unassigned/ready-to-assign money for its currency, or
   - be assigned directly to a category at entry for special cases such as reimbursements
2. Account balances may go negative where appropriate, including credit-like accounts.
3. Category overspending does not block transactions.
4. Category overspending should be shown clearly in the budget UI.
5. Default month rollover should subtract uncovered category overspending from the next month's budget.
6. There should also be an option to carry a negative category balance forward explicitly into the next month.
7. Transfer-linked transactions should be edited only through transfer-specific APIs.
8. Every transfer fee that affects balances should exist explicitly in the ledger.
9. Reconciliation in the initial implementation should use current-balance reconciliation.
10. Import duplicate detection should be advisory by default.
11. Imported transactions should behave like normal editable transactions after commit, while preserving visible provenance metadata.

### 23.14 Recommended initial answers

The current recommended behavioral defaults for v1 are:

- income may go to unassigned money or directly to a category when appropriate
- category overspending is allowed and clearly surfaced rather than blocked
- default month rollover subtracts uncovered overspending from next month's budget, with an option to carry negative category balances forward instead
- transfer-linked transactions are edited only through transfer APIs
- any fee that changes balances exists explicitly in the ledger
- reconciliation begins with a simpler current-balance model
- import duplicate detection is advisory first
- optimistic concurrency is nice to have but not mandatory for the earliest version
- reporting should default to a clearly labeled latest available rate or a user-selected reporting date
- imported transactions should be normal editable transactions after commit, with visible provenance

---

## 24. UX priorities

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

## 25. Open design questions

These do not block the project document, but should be refined during implementation.

1. Should category naming across currencies be duplicated explicitly in the UI, or should one conceptual category contain separate per-currency balances internally?
2. How much client-side local caching is worth supporting in v1 before it adds too much complexity?
3. Should exchange rates for reporting be entered manually at first, fetched from an API, or both?
4. How should fees for cross-currency transfer be categorized in the budget?
5. What minimum audit/history functionality should exist in a shared multi-user environment?
6. How should initial onboarding work for a migrated YNAB budget versus a fresh manual budget?
7. Should the first implementation support only one budget instance total, or one shared budget with future room for multiple budgets later?

---

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

## 27. Summary

This project is a privacy-first, self-hosted budgeting system centered on a shared household budget, YNAB-style envelope budgeting, and first-class multi-currency support.

The core implementation strategy is:

- central private server
- responsive browser client
- collaborative shared budget
- budgeting separated by currency
- clean support for imports, reconciliation, transfers, and reporting

The emphasis in v1 is not maximum features. It is a correct, elegant, trustworthy core.

