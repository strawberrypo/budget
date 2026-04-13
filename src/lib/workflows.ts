import type { Pool, PoolClient } from "pg";
import { hashPassword } from "@/lib/auth";
import {
  computeReconciliationDifference,
  deriveTransferKind,
  determineReconciliationStatus,
  toSignedTransactionAmount,
} from "@/lib/ledger";

export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function ensureBudgetPeriodFor(params: {
  db: Queryable;
  budgetId: string;
  year: number;
  month: number;
}) {
  const periodStart = new Date(Date.UTC(params.year, params.month - 1, 1));
  const periodEnd = new Date(Date.UTC(params.year, params.month, 0));
  const label = `${params.year}-${String(params.month).padStart(2, "0")}`;

  const result = await params.db.query<{ id: string }>(
    `
      insert into budget_periods (budget_id, period_start_date, period_end_date, label)
      values ($1, $2, $3, $4)
      on conflict (budget_id, period_start_date, period_end_date)
      do update set label = excluded.label
      returning id
    `,
    [
      params.budgetId,
      periodStart.toISOString().slice(0, 10),
      periodEnd.toISOString().slice(0, 10),
      label,
    ],
  );

  return result.rows[0].id;
}

export async function bootstrapBudget(params: {
  db: Queryable;
  displayName: string;
  email: string;
  password: string;
  budgetName: string;
  reportingCurrencyId: string;
}) {
  const existingUsers = await params.db.query<{ count: number }>(
    `select count(*)::int as count from users`,
  );

  if ((existingUsers.rows[0]?.count ?? 0) > 0) {
    throw new Error("Already bootstrapped");
  }

  const userResult = await params.db.query<{ id: string }>(
    `
      insert into users (display_name, email, password_hash)
      values ($1, $2, $3)
      returning id
    `,
    [
      params.displayName,
      params.email.toLowerCase(),
      hashPassword(params.password),
    ],
  );

  const budgetResult = await params.db.query<{ id: string }>(
    `
      insert into budgets (name, default_reporting_currency_id)
      values ($1, $2)
      returning id
    `,
    [params.budgetName, params.reportingCurrencyId],
  );

  await params.db.query(
    `
      insert into budget_memberships (budget_id, user_id, role)
      values ($1, $2, 'owner')
    `,
    [budgetResult.rows[0].id, userResult.rows[0].id],
  );

  return {
    userId: userResult.rows[0].id,
    budgetId: budgetResult.rows[0].id,
  };
}

export async function createAccountRecord(params: {
  db: Queryable;
  budgetId: string;
  userId: string;
  name: string;
  accountType: string;
  currencyId: string;
  openingBalanceAmount: number;
  openingBalanceDate: string;
}) {
  const result = await params.db.query<{ id: string }>(
    `
      insert into accounts (
        budget_id,
        name,
        account_type,
        currency_id,
        opening_balance_amount,
        opening_balance_date,
        created_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id
    `,
    [
      params.budgetId,
      params.name,
      params.accountType,
      params.currencyId,
      params.openingBalanceAmount,
      params.openingBalanceDate,
      params.userId,
    ],
  );

  return result.rows[0].id;
}

export async function createCategoryGroupRecord(params: {
  db: Queryable;
  budgetId: string;
  name: string;
}) {
  const result = await params.db.query<{ id: string }>(
    `
      insert into category_groups (budget_id, name)
      values ($1, $2)
      on conflict (budget_id, name)
      do update set updated_at = now()
      returning id
    `,
    [params.budgetId, params.name],
  );

  return result.rows[0].id;
}

export async function createCategoryRecord(params: {
  db: Queryable;
  budgetId: string;
  name: string;
  categoryGroupId?: string | null;
  currencyIds: string[];
}) {
  const categoryResult = await params.db.query<{ id: string }>(
    `
      insert into categories (budget_id, category_group_id, name)
      values ($1, $2, $3)
      returning id
    `,
    [params.budgetId, params.categoryGroupId ?? null, params.name],
  );

  for (const currencyId of params.currencyIds) {
    await params.db.query(
      `
        insert into category_currency_buckets (budget_id, category_id, currency_id)
        values ($1, $2, $3)
      `,
      [params.budgetId, categoryResult.rows[0].id, currencyId],
    );
  }

  return categoryResult.rows[0].id;
}

export async function createAssignmentEventRecord(params: {
  db: Queryable;
  budgetId: string;
  userId: string;
  budgetPeriodId: string;
  categoryCurrencyBucketId: string;
  amountDelta: number;
  memo?: string | null;
}) {
  const eventType = params.amountDelta > 0 ? "assign" : "unassign";

  const result = await params.db.query<{ id: string }>(
    `
      insert into budget_assignment_events (
        budget_id,
        budget_period_id,
        category_currency_bucket_id,
        amount_delta,
        event_type,
        memo,
        created_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id
    `,
    [
      params.budgetId,
      params.budgetPeriodId,
      params.categoryCurrencyBucketId,
      params.amountDelta,
      eventType,
      params.memo ?? null,
      params.userId,
    ],
  );

  return result.rows[0].id;
}

export async function upsertTransactionRecord(params: {
  db: Queryable;
  transactionId?: string;
  budgetId: string;
  userId: string;
  accountId: string;
  categoryCurrencyBucketId?: string;
  transactionDate: string;
  amount: number;
  transactionType: "income" | "expense" | "adjustment";
  payeeNameRaw?: string;
  memo?: string;
}) {
  const accountResult = await params.db.query<{ currency_id: string }>(
    `
      select currency_id
      from accounts
      where id = $1
        and budget_id = $2
        and is_closed = false
      limit 1
    `,
    [params.accountId, params.budgetId],
  );

  const account = accountResult.rows[0];
  if (!account) {
    throw new Error("Account not found");
  }

  if (params.categoryCurrencyBucketId) {
    const bucketResult = await params.db.query<{ currency_id: string }>(
      `
        select currency_id
        from category_currency_buckets
        where id = $1
          and budget_id = $2
          and is_active = true
        limit 1
      `,
      [params.categoryCurrencyBucketId, params.budgetId],
    );

    const bucket = bucketResult.rows[0];
    if (!bucket || bucket.currency_id !== account.currency_id) {
      throw new Error("Category currency mismatch");
    }
  }

  const signedAmount = toSignedTransactionAmount(
    params.transactionType,
    params.amount,
  );

  let transactionId = params.transactionId;

  if (transactionId) {
    await params.db.query(
      `
        update transactions
        set
          account_id = $3,
          transaction_date = $4,
          amount = $5,
          currency_id = $6,
          transaction_type = $7,
          payee_name_raw = $8,
          memo = $9,
          updated_by_user_id = $10,
          updated_at = now()
        where id = $1
          and budget_id = $2
          and deleted_at is null
      `,
      [
        transactionId,
        params.budgetId,
        params.accountId,
        params.transactionDate,
        signedAmount,
        account.currency_id,
        params.transactionType,
        params.payeeNameRaw ?? null,
        params.memo ?? null,
        params.userId,
      ],
    );

    await params.db.query(`delete from transaction_splits where transaction_id = $1`, [
      transactionId,
    ]);
  } else {
    const transactionResult = await params.db.query<{ id: string }>(
      `
        insert into transactions (
          budget_id,
          account_id,
          transaction_date,
          amount,
          currency_id,
          transaction_type,
          payee_name_raw,
          memo,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        returning id
      `,
      [
        params.budgetId,
        params.accountId,
        params.transactionDate,
        signedAmount,
        account.currency_id,
        params.transactionType,
        params.payeeNameRaw ?? null,
        params.memo ?? null,
        params.userId,
      ],
    );

    transactionId = transactionResult.rows[0].id;
  }

  if (params.categoryCurrencyBucketId) {
    await params.db.query(
      `
        insert into transaction_splits (
          transaction_id,
          category_currency_bucket_id,
          amount
        )
        values ($1, $2, $3)
      `,
      [transactionId, params.categoryCurrencyBucketId, signedAmount],
    );
  }

  return transactionId;
}

export async function createTransferRecord(params: {
  db: Queryable;
  budgetId: string;
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  transferDate: string;
  sourceAmount: number;
  destinationAmount: number;
  memo?: string;
}) {
  const accountsResult = await params.db.query<{ id: string; currency_id: string }>(
    `
      select id, currency_id
      from accounts
      where budget_id = $1
        and is_closed = false
        and id = any($2::uuid[])
    `,
    [params.budgetId, [params.sourceAccountId, params.destinationAccountId]],
  );

  const sourceAccount = accountsResult.rows.find((row) => row.id === params.sourceAccountId);
  const destinationAccount = accountsResult.rows.find(
    (row) => row.id === params.destinationAccountId,
  );

  if (!sourceAccount || !destinationAccount) {
    throw new Error("Account not found");
  }

  const transferKind = deriveTransferKind(
    sourceAccount.currency_id,
    destinationAccount.currency_id,
  );

  if (
    transferKind === "same_currency" &&
    params.sourceAmount !== params.destinationAmount
  ) {
    throw new Error("Same currency mismatch");
  }

  const transferResult = await params.db.query<{ id: string }>(
    `
      insert into transfers (
        budget_id,
        source_account_id,
        destination_account_id,
        transfer_date,
        transfer_kind,
        memo,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7)
      returning id
    `,
    [
      params.budgetId,
      params.sourceAccountId,
      params.destinationAccountId,
      params.transferDate,
      transferKind,
      params.memo ?? null,
      params.userId,
    ],
  );

  const outflowTransactionId = await params.db.query<{ id: string }>(
    `
      insert into transactions (
        budget_id, account_id, transaction_date, amount, currency_id, transaction_type, memo, created_by_user_id, updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, 'transfer_component', $6, $7, $7)
      returning id
    `,
    [
      params.budgetId,
      params.sourceAccountId,
      params.transferDate,
      -params.sourceAmount,
      sourceAccount.currency_id,
      params.memo ?? null,
      params.userId,
    ],
  );

  const inflowTransactionId = await params.db.query<{ id: string }>(
    `
      insert into transactions (
        budget_id, account_id, transaction_date, amount, currency_id, transaction_type, memo, created_by_user_id, updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, 'transfer_component', $6, $7, $7)
      returning id
    `,
    [
      params.budgetId,
      params.destinationAccountId,
      params.transferDate,
      params.destinationAmount,
      destinationAccount.currency_id,
      params.memo ?? null,
      params.userId,
    ],
  );

  await params.db.query(
    `
      insert into transfer_legs (
        transfer_id, transaction_id, account_id, leg_direction, amount, currency_id
      )
      values
        ($1, $2, $3, 'outflow', $4, $5),
        ($1, $6, $7, 'inflow', $8, $9)
    `,
    [
      transferResult.rows[0].id,
      outflowTransactionId.rows[0].id,
      params.sourceAccountId,
      params.sourceAmount,
      sourceAccount.currency_id,
      inflowTransactionId.rows[0].id,
      params.destinationAccountId,
      params.destinationAmount,
      destinationAccount.currency_id,
    ],
  );

  if (transferKind === "cross_currency") {
    await params.db.query(
      `
        insert into transfer_exchange_details (
          transfer_id,
          source_amount,
          source_currency_id,
          destination_amount,
          destination_currency_id,
          effective_exchange_rate
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        transferResult.rows[0].id,
        params.sourceAmount,
        sourceAccount.currency_id,
        params.destinationAmount,
        destinationAccount.currency_id,
        params.destinationAmount / params.sourceAmount,
      ],
    );
  }

  return transferResult.rows[0].id;
}

export async function reconcileAccountRecord(params: {
  db: Queryable;
  budgetId: string;
  userId: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  applyAdjustment: boolean;
  memo?: string;
}) {
  const accountResult = await params.db.query<{
    currency_id: string;
    computed_balance: string;
  }>(
    `
      select
        a.currency_id,
        (a.opening_balance_amount + coalesce(sum(t.amount), 0))::text as computed_balance
      from accounts a
      left join transactions t on t.account_id = a.id and t.deleted_at is null
      where a.id = $1
        and a.budget_id = $2
      group by a.id
      limit 1
    `,
    [params.accountId, params.budgetId],
  );

  const account = accountResult.rows[0];
  if (!account) {
    throw new Error("Account not found");
  }

  const computedBalance = Number(account.computed_balance);
  const differenceAmount = computeReconciliationDifference(
    params.statementBalance,
    computedBalance,
  );

  let adjustmentTransactionId: string | null = null;
  let status = determineReconciliationStatus(differenceAmount, false);

  if (differenceAmount !== 0 && params.applyAdjustment) {
    const transactionResult = await params.db.query<{ id: string }>(
      `
        insert into transactions (
          budget_id, account_id, transaction_date, amount, currency_id, transaction_type, memo, created_by_user_id, updated_by_user_id
        )
        values ($1, $2, $3, $4, $5, 'adjustment', $6, $7, $7)
        returning id
      `,
      [
        params.budgetId,
        params.accountId,
        params.statementDate,
        differenceAmount,
        account.currency_id,
        params.memo || "Reconciliation adjustment",
        params.userId,
      ],
    );

    adjustmentTransactionId = transactionResult.rows[0].id;
    status = determineReconciliationStatus(differenceAmount, true);
  }

  const result = await params.db.query<{ id: string }>(
    `
      insert into reconciliation_events (
        budget_id,
        account_id,
        statement_date,
        statement_balance,
        computed_balance_at_time,
        difference_amount,
        status,
        adjustment_transaction_id,
        notes,
        reconciled_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id
    `,
    [
      params.budgetId,
      params.accountId,
      params.statementDate,
      params.statementBalance,
      computedBalance,
      differenceAmount,
      status,
      adjustmentTransactionId,
      params.memo ?? null,
      params.userId,
    ],
  );

  return {
    reconciliationEventId: result.rows[0].id,
    differenceAmount,
    status,
    adjustmentTransactionId,
  };
}
