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

1. **The server database is canonical**  
   All authoritative financial state lives on the server.

2. **Native currency values are always preserved**  
   Account balances, transactions, transfers, and reconciliation records are stored in their native currencies.

3. **Budgeting is currency-specific**  
   Category balances must be tracked separately by currency.

4. **Ledger events are append-oriented**  
   As much as practical, financial state should be derived from explicit records rather than hidden mutable totals.

5. **Reporting conversions are derived views**  
   Converted summaries should come from exchange-rate data and native ledger values, not replace them.

6. **Shared-budget collaboration requires user attribution**  
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

Important note:
A category is a conceptual label such as Groceries or Rent. Because budgeting is currency-specific, actual budget balances must not live directly on the category alone.

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

Recommended design note:
Instead of storing mutable summary totals here as authoritative truth, consider deriving these values from budgeting and transaction tables where practical, or storing cached totals with careful invariants.

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

Recommended approach:
Prefer modeling assignment changes as explicit delta events if you want stronger history/audit later. For a simpler v1, a single current assigned amount per category/currency/period may be acceptable if revisions are tracked elsewhere.

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
- `transaction_type` (income, expense, adjustment, transfer_component, etc.)
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
- `transfer_kind` (same_currency, cross_currency)

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
- `status` (matched, mismatch_reviewed, adjusted)
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
- `source_type` (manual, api, transfer_implied)
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
- `source_type` (ynab_csv, generic_csv, etc.)
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
- `backup_type` (database, csv_export, json_export)
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

Design recommendation:
Keep the canonical ledger and assignment records clean, and derive summaries from them. Introduce cached/materialized summaries only when performance actually requires them.

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

