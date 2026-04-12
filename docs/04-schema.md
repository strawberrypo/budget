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
5. budget_memberships
6. accounts
7. category_groups
8. categories
9. category_currency_buckets
10. budget_periods
11. budget_assignment_events
12. payees
13. import_jobs
14. transactions
15. transaction_splits
16. transfers
17. transfer_legs
18. transfer_exchange_details
19. reconciliation_events
20. exchange_rate_records
21. import_staging_rows
22. backup_records

---

### 22.14 Remaining schema-level questions

1. Should fees attached to cross-currency transfers always generate their own transaction row, or only when the UX explicitly exposes them as separate spending events?
2. Should import-generated transactions be marked immutable until confirmed, or simply be normal editable transactions after commit?
3. Should the system support uncategorized inflow staging, or require immediate categorization semantics consistent with strict YNAB-like behavior?
4. Should category names be globally unique per budget, or should the UI eventually allow duplicate display names under different groups?

---

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


