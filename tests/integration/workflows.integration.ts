import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { ensureDefaultCurrencies } from "../../src/lib/budget";
import {
  bootstrapBudget,
  createAccountRecord,
  createAssignmentEventRecord,
  createCategoryGroupRecord,
  createCategoryRecord,
  createTransferRecord,
  ensureBudgetPeriodFor,
  reconcileAccountRecord,
  upsertTransactionRecord,
} from "../../src/lib/workflows";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const schemaSqlPath = resolve(process.cwd(), "db/schema.sql");

async function createIsolatedClient() {
  if (!connectionString) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const schema = `test_${randomUUID().replace(/-/g, "")}`;
  const schemaSql = await readFile(schemaSqlPath, "utf8");

  await client.query(`create schema ${schema}`);
  await client.query(`set search_path to ${schema}, public`);
  await client.query(schemaSql);
  await ensureDefaultCurrencies(client);

  return {
    client,
    schema,
    async dispose() {
      await client.query(`drop schema if exists ${schema} cascade`);
      client.release();
      await pool.end();
    },
  };
}

test("bootstrap, budgeting, and categorized transactions persist correctly", async () => {
  const isolated = await createIsolatedClient();

  try {
    await isolated.client.query("begin");

    const usd = await isolated.client.query<{ id: string }>(
      `select id from currencies where code = 'USD' limit 1`,
    );

    const { userId, budgetId } = await bootstrapBudget({
      db: isolated.client,
      displayName: "Owner",
      email: "owner@example.com",
      password: "integration-test-password",
      budgetName: "Household Budget",
      reportingCurrencyId: usd.rows[0].id,
    });

    const accountId = await createAccountRecord({
      db: isolated.client,
      budgetId,
      userId,
      name: "Checking",
      accountType: "checking",
      currencyId: usd.rows[0].id,
      openingBalanceAmount: 100,
      openingBalanceDate: "2026-04-01",
    });

    const groupId = await createCategoryGroupRecord({
      db: isolated.client,
      budgetId,
      name: "Living",
    });

    const categoryId = await createCategoryRecord({
      db: isolated.client,
      budgetId,
      name: "Groceries",
      categoryGroupId: groupId,
      currencyIds: [usd.rows[0].id],
    });

    const bucket = await isolated.client.query<{ id: string }>(
      `
        select id
        from category_currency_buckets
        where category_id = $1
        limit 1
      `,
      [categoryId],
    );

    const periodId = await ensureBudgetPeriodFor({
      db: isolated.client,
      budgetId,
      year: 2026,
      month: 4,
    });

    await createAssignmentEventRecord({
      db: isolated.client,
      budgetId,
      userId,
      budgetPeriodId: periodId,
      categoryCurrencyBucketId: bucket.rows[0].id,
      amountDelta: 50,
    });

    await upsertTransactionRecord({
      db: isolated.client,
      budgetId,
      userId,
      accountId,
      transactionDate: "2026-04-02",
      amount: 200,
      transactionType: "income",
      memo: "Paycheck",
    });

    const expenseId = await upsertTransactionRecord({
      db: isolated.client,
      budgetId,
      userId,
      accountId,
      categoryCurrencyBucketId: bucket.rows[0].id,
      transactionDate: "2026-04-03",
      amount: 25,
      transactionType: "expense",
      payeeNameRaw: "Store",
    });

    const transaction = await isolated.client.query<{ amount: string }>(
      `select amount::text from transactions where id = $1`,
      [expenseId],
    );

    const split = await isolated.client.query<{ amount: string }>(
      `select amount::text from transaction_splits where transaction_id = $1`,
      [expenseId],
    );

    const accountBalance = await isolated.client.query<{ balance: string }>(
      `
        select (opening_balance_amount + coalesce(sum(t.amount), 0))::text as balance
        from accounts a
        left join transactions t on t.account_id = a.id and t.deleted_at is null
        where a.id = $1
        group by a.id
      `,
      [accountId],
    );

    assert.equal(transaction.rows[0].amount, "-25.000000");
    assert.equal(split.rows[0].amount, "-25.000000");
    assert.equal(accountBalance.rows[0].balance, "275.000000");

    await isolated.client.query("commit");
  } finally {
    await isolated.dispose();
  }
});

test("same-currency transfer mismatch is rejected", async () => {
  const isolated = await createIsolatedClient();

  try {
    await isolated.client.query("begin");

    const usd = await isolated.client.query<{ id: string }>(
      `select id from currencies where code = 'USD' limit 1`,
    );

    const { userId, budgetId } = await bootstrapBudget({
      db: isolated.client,
      displayName: "Owner",
      email: "owner@example.com",
      password: "integration-test-password",
      budgetName: "Household Budget",
      reportingCurrencyId: usd.rows[0].id,
    });

    const sourceAccountId = await createAccountRecord({
      db: isolated.client,
      budgetId,
      userId,
      name: "Checking",
      accountType: "checking",
      currencyId: usd.rows[0].id,
      openingBalanceAmount: 100,
      openingBalanceDate: "2026-04-01",
    });

    const destinationAccountId = await createAccountRecord({
      db: isolated.client,
      budgetId,
      userId,
      name: "Savings",
      accountType: "savings",
      currencyId: usd.rows[0].id,
      openingBalanceAmount: 0,
      openingBalanceDate: "2026-04-01",
    });

    await assert.rejects(
      () =>
        createTransferRecord({
          db: isolated.client,
          budgetId,
          userId,
          sourceAccountId,
          destinationAccountId,
          transferDate: "2026-04-04",
          sourceAmount: 10,
          destinationAmount: 11,
        }),
      /Same currency mismatch/,
    );

    await isolated.client.query("rollback");
  } finally {
    await isolated.dispose();
  }
});

test("reconciliation with adjustment creates event and adjustment transaction", async () => {
  const isolated = await createIsolatedClient();

  try {
    await isolated.client.query("begin");

    const usd = await isolated.client.query<{ id: string }>(
      `select id from currencies where code = 'USD' limit 1`,
    );

    const { userId, budgetId } = await bootstrapBudget({
      db: isolated.client,
      displayName: "Owner",
      email: "owner@example.com",
      password: "integration-test-password",
      budgetName: "Household Budget",
      reportingCurrencyId: usd.rows[0].id,
    });

    const accountId = await createAccountRecord({
      db: isolated.client,
      budgetId,
      userId,
      name: "Checking",
      accountType: "checking",
      currencyId: usd.rows[0].id,
      openingBalanceAmount: 100,
      openingBalanceDate: "2026-04-01",
    });

    const reconciliation = await reconcileAccountRecord({
      db: isolated.client,
      budgetId,
      userId,
      accountId,
      statementDate: "2026-04-05",
      statementBalance: 95,
      applyAdjustment: true,
      memo: "Bank statement",
    });

    const event = await isolated.client.query<{
      status: string;
      difference_amount: string;
      adjustment_transaction_id: string | null;
    }>(
      `
        select status, difference_amount::text, adjustment_transaction_id
        from reconciliation_events
        where id = $1
      `,
      [reconciliation.reconciliationEventId],
    );

    const adjustment = await isolated.client.query<{ amount: string }>(
      `
        select amount::text
        from transactions
        where id = $1
      `,
      [reconciliation.adjustmentTransactionId],
    );

    assert.equal(event.rows[0].status, "adjusted");
    assert.equal(event.rows[0].difference_amount, "-5.000000");
    assert.equal(adjustment.rows[0].amount, "-5.000000");

    await isolated.client.query("commit");
  } finally {
    await isolated.dispose();
  }
});
