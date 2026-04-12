create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text unique,
  password_hash text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text not null,
  decimal_places integer not null default 2 check (decimal_places >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_reporting_currency_id uuid references currencies(id),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_memberships (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  user_id uuid not null references users(id),
  role text not null default 'member' check (role in ('owner', 'member')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (budget_id, user_id)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  device_label text,
  session_token_hash text not null unique,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  name text not null,
  account_type text not null check (account_type in ('checking', 'savings', 'cash', 'credit', 'other')),
  currency_id uuid not null references currencies(id),
  opening_balance_amount numeric(20, 6) not null default 0,
  opening_balance_date date not null,
  is_closed boolean not null default false,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, name)
);

create table if not exists category_groups (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  name text not null,
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, name)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  category_group_id uuid references category_groups(id),
  name text not null,
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, name)
);

create table if not exists category_currency_buckets (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  category_id uuid not null references categories(id),
  currency_id uuid not null references currencies(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, currency_id)
);

create table if not exists budget_periods (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  period_start_date date not null,
  period_end_date date not null check (period_end_date >= period_start_date),
  label text not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, period_start_date, period_end_date)
);

create table if not exists budget_assignment_events (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  budget_period_id uuid not null references budget_periods(id),
  category_currency_bucket_id uuid not null references category_currency_buckets(id),
  amount_delta numeric(20, 6) not null,
  event_type text not null check (
    event_type in ('assign', 'unassign', 'move_in', 'move_out', 'carryover_adjustment')
  ),
  memo text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists payees (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  name text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, name)
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  uploaded_by_user_id uuid references users(id),
  source_type text not null,
  original_filename text not null,
  status text not null check (
    status in ('uploaded', 'mapped', 'previewed', 'validated', 'committed', 'failed')
  ),
  raw_file_path text,
  mapping_config_json jsonb,
  validation_summary_json jsonb,
  import_summary_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  account_id uuid not null references accounts(id),
  transaction_date date not null,
  posted_date date,
  amount numeric(20, 6) not null check (amount <> 0),
  currency_id uuid not null references currencies(id),
  transaction_type text not null check (
    transaction_type in ('income', 'expense', 'adjustment', 'transfer_component')
  ),
  status text not null default 'posted',
  payee_id uuid references payees(id),
  payee_name_raw text,
  memo text,
  import_job_id uuid references import_jobs(id),
  external_import_key text,
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id),
  category_currency_bucket_id uuid not null references category_currency_buckets(id),
  amount numeric(20, 6) not null check (amount <> 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  source_account_id uuid not null references accounts(id),
  destination_account_id uuid not null references accounts(id),
  transfer_date date not null,
  transfer_kind text not null check (transfer_kind in ('same_currency', 'cross_currency')),
  memo text,
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_account_id <> destination_account_id)
);

create table if not exists transfer_legs (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references transfers(id),
  transaction_id uuid not null unique references transactions(id),
  account_id uuid not null references accounts(id),
  leg_direction text not null check (leg_direction in ('outflow', 'inflow')),
  amount numeric(20, 6) not null check (amount <> 0),
  currency_id uuid not null references currencies(id),
  created_at timestamptz not null default now()
);

create table if not exists transfer_exchange_details (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null unique references transfers(id),
  source_amount numeric(20, 6) not null check (source_amount > 0),
  source_currency_id uuid not null references currencies(id),
  destination_amount numeric(20, 6) not null check (destination_amount > 0),
  destination_currency_id uuid not null references currencies(id),
  effective_exchange_rate numeric(20, 10),
  fee_amount numeric(20, 6) check (fee_amount is null or fee_amount >= 0),
  fee_currency_id uuid references currencies(id),
  fee_category_currency_bucket_id uuid references category_currency_buckets(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id),
  account_id uuid not null references accounts(id),
  statement_date date not null,
  statement_balance numeric(20, 6) not null,
  computed_balance_at_time numeric(20, 6) not null,
  difference_amount numeric(20, 6) not null,
  status text not null check (status in ('matched', 'mismatch_reviewed', 'adjusted')),
  adjustment_transaction_id uuid references transactions(id),
  notes text,
  reconciled_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exchange_rate_records (
  id uuid primary key default gen_random_uuid(),
  base_currency_id uuid not null references currencies(id),
  quote_currency_id uuid not null references currencies(id),
  rate numeric(20, 10) not null check (rate > 0),
  rate_date date not null,
  source_type text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  unique (base_currency_id, quote_currency_id, rate_date, source_type),
  check (base_currency_id <> quote_currency_id)
);

create table if not exists import_staging_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references import_jobs(id),
  row_index integer not null,
  raw_row_json jsonb not null,
  parsed_row_json jsonb,
  validation_status text not null,
  validation_errors_json jsonb,
  matched_account_id uuid references accounts(id),
  matched_category_id uuid references categories(id),
  matched_payee_id uuid references payees(id),
  proposed_transaction_date date,
  proposed_amount numeric(20, 6),
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_accounts_budget_id on accounts(budget_id);
create index if not exists idx_accounts_currency_id on accounts(currency_id);
create index if not exists idx_budget_assignment_events_budget_id on budget_assignment_events(budget_id);
create index if not exists idx_budget_assignment_events_period_id on budget_assignment_events(budget_period_id);
create index if not exists idx_budget_assignment_events_bucket_id on budget_assignment_events(category_currency_bucket_id);
create index if not exists idx_transactions_budget_id on transactions(budget_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_date on transactions(transaction_date);
create index if not exists idx_transactions_account_date on transactions(account_id, transaction_date);
create index if not exists idx_transactions_import_job_id on transactions(import_job_id);
