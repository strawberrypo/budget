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

