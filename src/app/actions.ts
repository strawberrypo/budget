"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, hashPassword, clearSession } from "@/lib/auth";
import {
  accountSchema,
  accountCloseSchema,
  accountUpdateSchema,
  assignmentSchema,
  assignmentReverseSchema,
  categoryGroupHideSchema,
  categoryGroupSchema,
  categoryGroupUpdateSchema,
  categoryHideSchema,
  categorySchema,
  categoryUpdateSchema,
  setupSchema,
  transferSchema,
  transactionSchema,
  transactionUpdateSchema,
  transactionVoidSchema,
  reconciliationSchema,
} from "@/lib/forms";
import { db } from "@/lib/db";
import {
  computeReconciliationDifference,
  deriveTransferKind,
  determineReconciliationStatus,
  toSignedTransactionAmount,
} from "@/lib/ledger";
import {
  ensureBudgetPeriod,
  ensureDefaultCurrencies,
  getBootstrapStatus,
  requireBudgetAccess,
} from "@/lib/budget";

function normalizeErrorPath(path: string, message: string) {
  const encoded = encodeURIComponent(message);
  return `${path}?error=${encoded}`;
}

function redirectTo(path: string): never {
  redirect(path as never);
}

export async function signOut() {
  await clearSession();
  redirectTo("/login");
}

export async function completeSetup(formData: FormData) {
  const bootstrap = await getBootstrapStatus();
  if (bootstrap.isBootstrapped) {
    redirectTo("/login");
  }

  const parsed = setupSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    budgetName: formData.get("budgetName"),
    reportingCurrencyId: formData.get("reportingCurrencyId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/setup", "Invalid setup input."));
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    await ensureDefaultCurrencies(client);

    const existingUsers = await client.query(`select count(*)::int as count from users`);
    if ((existingUsers.rows[0]?.count ?? 0) > 0) {
      await client.query("rollback");
      redirectTo("/login");
    }

    const userResult = await client.query<{ id: string }>(
      `
        insert into users (display_name, email, password_hash)
        values ($1, $2, $3)
        returning id
      `,
      [
        parsed.data.displayName,
        parsed.data.email.toLowerCase(),
        hashPassword(parsed.data.password),
      ],
    );

    const budgetResult = await client.query<{ id: string }>(
      `
        insert into budgets (name, default_reporting_currency_id)
        values ($1, $2)
        returning id
      `,
      [parsed.data.budgetName, parsed.data.reportingCurrencyId],
    );

    await client.query(
      `
        insert into budget_memberships (budget_id, user_id, role)
        values ($1, $2, 'owner')
      `,
      [budgetResult.rows[0].id, userResult.rows[0].id],
    );

    await client.query("commit");

    await createSession({
      userId: userResult.rows[0].id,
      deviceLabel: "browser",
    });
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/setup", "Setup failed."));
  } finally {
    client.release();
  }

  redirectTo("/");
}

export async function createAccount(formData: FormData) {
  const access = await requireBudgetAccess();

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    accountType: formData.get("accountType"),
    currencyId: formData.get("currencyId"),
    openingBalanceAmount: formData.get("openingBalanceAmount"),
    openingBalanceDate: formData.get("openingBalanceDate"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/accounts", "Invalid account input."));
  }

  await db.query(
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
    `,
    [
      access.budgetId,
      parsed.data.name,
      parsed.data.accountType,
      parsed.data.currencyId,
      parsed.data.openingBalanceAmount,
      parsed.data.openingBalanceDate,
      access.userId,
    ],
  );

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

export async function updateAccount(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = accountUpdateSchema.safeParse({
    accountId: formData.get("accountId"),
    name: formData.get("name"),
    accountType: formData.get("accountType"),
    currencyId: formData.get("currencyId"),
    openingBalanceAmount: formData.get("openingBalanceAmount"),
    openingBalanceDate: formData.get("openingBalanceDate"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/accounts", "Invalid account update."));
  }

  const existing = await db.query<{ currency_id: string }>(
    `
      select currency_id
      from accounts
      where id = $1
        and budget_id = $2
      limit 1
    `,
    [parsed.data.accountId, access.budgetId],
  );

  if (!existing.rows[0] || existing.rows[0].currency_id !== parsed.data.currencyId) {
    redirectTo(
      normalizeErrorPath(
        "/accounts",
        "Changing an account currency is not supported after creation.",
      ),
    );
  }

  await db.query(
    `
      update accounts
      set
        name = $3,
        account_type = $4,
        opening_balance_amount = $5,
        opening_balance_date = $6,
        updated_at = now()
      where id = $1
        and budget_id = $2
    `,
    [
      parsed.data.accountId,
      access.budgetId,
      parsed.data.name,
      parsed.data.accountType,
      parsed.data.openingBalanceAmount,
      parsed.data.openingBalanceDate,
    ],
  );

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

export async function closeAccount(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = accountCloseSchema.safeParse({
    accountId: formData.get("accountId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/accounts", "Invalid account close request."));
  }

  await db.query(
    `
      update accounts
      set is_closed = true, updated_at = now()
      where id = $1
        and budget_id = $2
    `,
    [parsed.data.accountId, access.budgetId],
  );

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

export async function createCategoryGroup(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categoryGroupSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category group input."));
  }

  await db.query(
    `
      insert into category_groups (budget_id, name)
      values ($1, $2)
      on conflict (budget_id, name) do nothing
    `,
    [access.budgetId, parsed.data.name],
  );

  revalidatePath("/categories");
}

export async function updateCategoryGroup(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categoryGroupUpdateSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category group update."));
  }

  await db.query(
    `
      update category_groups
      set name = $3, updated_at = now()
      where id = $1
        and budget_id = $2
    `,
    [parsed.data.groupId, access.budgetId, parsed.data.name],
  );

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function hideCategoryGroup(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categoryGroupHideSchema.safeParse({
    groupId: formData.get("groupId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category group request."));
  }

  await db.query(
    `
      update category_groups
      set is_hidden = true, updated_at = now()
      where id = $1
        and budget_id = $2
    `,
    [parsed.data.groupId, access.budgetId],
  );

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function createCategory(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    categoryGroupId: formData.get("categoryGroupId"),
    newGroupName: formData.get("newGroupName"),
    currencyIds: formData.getAll("currencyIds"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category input."));
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    let categoryGroupId = parsed.data.categoryGroupId || null;

    if (!categoryGroupId && parsed.data.newGroupName) {
      const groupResult = await client.query<{ id: string }>(
        `
          insert into category_groups (budget_id, name)
          values ($1, $2)
          on conflict (budget_id, name)
          do update set updated_at = now()
          returning id
        `,
        [access.budgetId, parsed.data.newGroupName],
      );
      categoryGroupId = groupResult.rows[0].id;
    }

    const categoryResult = await client.query<{ id: string }>(
      `
        insert into categories (budget_id, category_group_id, name)
        values ($1, $2, $3)
        returning id
      `,
      [access.budgetId, categoryGroupId, parsed.data.name],
    );

    for (const currencyId of parsed.data.currencyIds) {
      await client.query(
        `
          insert into category_currency_buckets (budget_id, category_id, currency_id)
          values ($1, $2, $3)
        `,
        [access.budgetId, categoryResult.rows[0].id, currencyId],
      );
    }

    await client.query("commit");
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/categories", "Failed to create category."));
  } finally {
    client.release();
  }

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function updateCategory(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categoryUpdateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    categoryGroupId: formData.get("categoryGroupId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category update."));
  }

  await db.query(
    `
      update categories
      set
        name = $3,
        category_group_id = $4,
        updated_at = now()
      where id = $1
        and budget_id = $2
    `,
    [
      parsed.data.categoryId,
      access.budgetId,
      parsed.data.name,
      parsed.data.categoryGroupId || null,
    ],
  );

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function hideCategory(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = categoryHideSchema.safeParse({
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid category hide request."));
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    await client.query(
      `
        update categories
        set is_hidden = true, updated_at = now()
        where id = $1
          and budget_id = $2
      `,
      [parsed.data.categoryId, access.budgetId],
    );
    await client.query(
      `
        update category_currency_buckets
        set is_active = false, updated_at = now()
        where category_id = $1
          and budget_id = $2
      `,
      [parsed.data.categoryId, access.budgetId],
    );
    await client.query("commit");
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/categories", "Failed to hide category."));
  } finally {
    client.release();
  }

  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function assignBudgetMoney(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = assignmentSchema.safeParse({
    categoryCurrencyBucketId: formData.get("categoryCurrencyBucketId"),
    amountDelta: formData.get("amountDelta"),
    memo: formData.get("memo"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid assignment input."));
  }

  const now = new Date();
  const budgetPeriodId = await ensureBudgetPeriod({
    budgetId: access.budgetId,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });

  const eventType =
    parsed.data.amountDelta > 0 ? "assign" : "unassign";

  await db.query(
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
    `,
    [
      access.budgetId,
      budgetPeriodId,
      parsed.data.categoryCurrencyBucketId,
      parsed.data.amountDelta,
      eventType,
      parsed.data.memo || null,
      access.userId,
    ],
  );

  revalidatePath("/");
  revalidatePath("/categories");
}

export async function reverseAssignmentEvent(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = assignmentReverseSchema.safeParse({
    assignmentEventId: formData.get("assignmentEventId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/categories", "Invalid assignment reversal."));
  }

  const eventResult = await db.query<{
    budget_period_id: string;
    category_currency_bucket_id: string;
    amount_delta: string;
  }>(
    `
      select budget_period_id, category_currency_bucket_id, amount_delta::text
      from budget_assignment_events
      where id = $1
        and budget_id = $2
      limit 1
    `,
    [parsed.data.assignmentEventId, access.budgetId],
  );

  const event = eventResult.rows[0];
  if (!event) {
    redirectTo(normalizeErrorPath("/categories", "Assignment event not found."));
  }

  const amountDelta = -Number(event.amount_delta);
  const eventType = amountDelta > 0 ? "assign" : "unassign";

  await db.query(
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
    `,
    [
      access.budgetId,
      event.budget_period_id,
      event.category_currency_bucket_id,
      amountDelta,
      eventType,
      "Reversal",
      access.userId,
    ],
  );

  revalidatePath("/");
  revalidatePath("/categories");
}

async function upsertTransaction(params: {
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
  const client = await db.connect();

  try {
    await client.query("begin");

    const accountResult = await client.query<{ currency_id: string }>(
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
      const bucketResult = await client.query<{ currency_id: string }>(
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
      await client.query(
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
          params.payeeNameRaw || null,
          params.memo || null,
          params.userId,
        ],
      );

      await client.query(`delete from transaction_splits where transaction_id = $1`, [
        transactionId,
      ]);
    } else {
      const transactionResult = await client.query<{ id: string }>(
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
          params.payeeNameRaw || null,
          params.memo || null,
          params.userId,
        ],
      );

      transactionId = transactionResult.rows[0].id;
    }

    if (params.categoryCurrencyBucketId) {
      await client.query(
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

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createTransaction(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = transactionSchema.safeParse({
    accountId: formData.get("accountId"),
    categoryCurrencyBucketId: formData.get("categoryCurrencyBucketId"),
    transactionDate: formData.get("transactionDate"),
    amount: formData.get("amount"),
    transactionType: formData.get("transactionType"),
    payeeNameRaw: formData.get("payeeNameRaw"),
    memo: formData.get("memo"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/transactions", "Invalid transaction input."));
  }

  if (
    parsed.data.transactionType === "expense" &&
    !parsed.data.categoryCurrencyBucketId
  ) {
    redirectTo(
      normalizeErrorPath("/transactions", "Expense transactions need a category."),
    );
  }

  try {
    await upsertTransaction({
      budgetId: access.budgetId,
      userId: access.userId,
      accountId: parsed.data.accountId,
      categoryCurrencyBucketId: parsed.data.categoryCurrencyBucketId || undefined,
      transactionDate: parsed.data.transactionDate,
      amount: parsed.data.amount,
      transactionType: parsed.data.transactionType,
      payeeNameRaw: parsed.data.payeeNameRaw || undefined,
      memo: parsed.data.memo || undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Category currency mismatch") {
      redirectTo(
        normalizeErrorPath(
          "/transactions",
          "Account and category currencies must match.",
        ),
      );
    }
    redirectTo(normalizeErrorPath("/transactions", "Failed to create transaction."));
  }

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function updateTransaction(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = transactionUpdateSchema.safeParse({
    transactionId: formData.get("transactionId"),
    accountId: formData.get("accountId"),
    categoryCurrencyBucketId: formData.get("categoryCurrencyBucketId"),
    transactionDate: formData.get("transactionDate"),
    amount: formData.get("amount"),
    transactionType: formData.get("transactionType"),
    payeeNameRaw: formData.get("payeeNameRaw"),
    memo: formData.get("memo"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/transactions", "Invalid transaction update."));
  }

  if (
    parsed.data.transactionType === "expense" &&
    !parsed.data.categoryCurrencyBucketId
  ) {
    redirectTo(
      normalizeErrorPath("/transactions", "Expense transactions need a category."),
    );
  }

  try {
    await upsertTransaction({
      transactionId: parsed.data.transactionId,
      budgetId: access.budgetId,
      userId: access.userId,
      accountId: parsed.data.accountId,
      categoryCurrencyBucketId: parsed.data.categoryCurrencyBucketId || undefined,
      transactionDate: parsed.data.transactionDate,
      amount: parsed.data.amount,
      transactionType: parsed.data.transactionType,
      payeeNameRaw: parsed.data.payeeNameRaw || undefined,
      memo: parsed.data.memo || undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Category currency mismatch") {
      redirectTo(
        normalizeErrorPath(
          "/transactions",
          "Account and category currencies must match.",
        ),
      );
    }
    redirectTo(normalizeErrorPath("/transactions", "Failed to update transaction."));
  }

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function voidTransaction(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = transactionVoidSchema.safeParse({
    transactionId: formData.get("transactionId"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/transactions", "Invalid transaction void request."));
  }

  await db.query(
    `
      update transactions
      set deleted_at = now(), updated_at = now(), updated_by_user_id = $3
      where id = $1
        and budget_id = $2
        and deleted_at is null
    `,
    [parsed.data.transactionId, access.budgetId, access.userId],
  );

  await db.query(`delete from transaction_splits where transaction_id = $1`, [
    parsed.data.transactionId,
  ]);

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/transactions");
}

export async function createTransfer(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = transferSchema.safeParse({
    sourceAccountId: formData.get("sourceAccountId"),
    destinationAccountId: formData.get("destinationAccountId"),
    transferDate: formData.get("transferDate"),
    sourceAmount: formData.get("sourceAmount"),
    destinationAmount: formData.get("destinationAmount"),
    memo: formData.get("memo"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/transfers", "Invalid transfer input."));
  }

  if (parsed.data.sourceAccountId === parsed.data.destinationAccountId) {
    redirectTo(normalizeErrorPath("/transfers", "Source and destination accounts must differ."));
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const accountsResult = await client.query<{
      id: string;
      currency_id: string;
    }>(
      `
        select id, currency_id
        from accounts
        where budget_id = $1
          and is_closed = false
          and id = any($2::uuid[])
      `,
      [access.budgetId, [parsed.data.sourceAccountId, parsed.data.destinationAccountId]],
    );

    const sourceAccount = accountsResult.rows.find(
      (row) => row.id === parsed.data.sourceAccountId,
    );
    const destinationAccount = accountsResult.rows.find(
      (row) => row.id === parsed.data.destinationAccountId,
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
      parsed.data.sourceAmount !== parsed.data.destinationAmount
    ) {
      redirectTo(
        normalizeErrorPath(
          "/transfers",
          "Same-currency transfers must preserve the amount exactly.",
        ),
      );
    }

    const transferResult = await client.query<{ id: string }>(
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
        access.budgetId,
        parsed.data.sourceAccountId,
        parsed.data.destinationAccountId,
        parsed.data.transferDate,
        transferKind,
        parsed.data.memo || null,
        access.userId,
      ],
    );

    const outflowTransaction = await client.query<{ id: string }>(
      `
        insert into transactions (
          budget_id,
          account_id,
          transaction_date,
          amount,
          currency_id,
          transaction_type,
          memo,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, $3, $4, $5, 'transfer_component', $6, $7, $7)
        returning id
      `,
      [
        access.budgetId,
        parsed.data.sourceAccountId,
        parsed.data.transferDate,
        -parsed.data.sourceAmount,
        sourceAccount.currency_id,
        parsed.data.memo || null,
        access.userId,
      ],
    );

    const inflowTransaction = await client.query<{ id: string }>(
      `
        insert into transactions (
          budget_id,
          account_id,
          transaction_date,
          amount,
          currency_id,
          transaction_type,
          memo,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1, $2, $3, $4, $5, 'transfer_component', $6, $7, $7)
        returning id
      `,
      [
        access.budgetId,
        parsed.data.destinationAccountId,
        parsed.data.transferDate,
        parsed.data.destinationAmount,
        destinationAccount.currency_id,
        parsed.data.memo || null,
        access.userId,
      ],
    );

    await client.query(
      `
        insert into transfer_legs (
          transfer_id,
          transaction_id,
          account_id,
          leg_direction,
          amount,
          currency_id
        )
        values
          ($1, $2, $3, 'outflow', $4, $5),
          ($1, $6, $7, 'inflow', $8, $9)
      `,
      [
        transferResult.rows[0].id,
        outflowTransaction.rows[0].id,
        parsed.data.sourceAccountId,
        parsed.data.sourceAmount,
        sourceAccount.currency_id,
        inflowTransaction.rows[0].id,
        parsed.data.destinationAccountId,
        parsed.data.destinationAmount,
        destinationAccount.currency_id,
      ],
    );

    if (transferKind === "cross_currency") {
      await client.query(
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
          parsed.data.sourceAmount,
          sourceAccount.currency_id,
          parsed.data.destinationAmount,
          destinationAccount.currency_id,
          parsed.data.destinationAmount / parsed.data.sourceAmount,
        ],
      );
    }

    await client.query("commit");
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/transfers", "Failed to create transfer."));
  } finally {
    client.release();
  }

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/transfers");
}

export async function reconcileAccount(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = reconciliationSchema.safeParse({
    accountId: formData.get("accountId"),
    statementDate: formData.get("statementDate"),
    statementBalance: formData.get("statementBalance"),
    applyAdjustment: formData.get("applyAdjustment") ?? "no",
    memo: formData.get("memo"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/reconciliation", "Invalid reconciliation input."));
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const accountResult = await client.query<{
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
      [parsed.data.accountId, access.budgetId],
    );

    const account = accountResult.rows[0];
    if (!account) {
      throw new Error("Account not found");
    }

    const computedBalance = Number(account.computed_balance);
    const differenceAmount = computeReconciliationDifference(
      parsed.data.statementBalance,
      computedBalance,
    );

    let adjustmentTransactionId: string | null = null;
    let status: "matched" | "mismatch_reviewed" | "adjusted" =
      determineReconciliationStatus(differenceAmount, false);

    if (differenceAmount !== 0 && parsed.data.applyAdjustment === "yes") {
      const transactionResult = await client.query<{ id: string }>(
        `
          insert into transactions (
            budget_id,
            account_id,
            transaction_date,
            amount,
            currency_id,
            transaction_type,
            memo,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, $5, 'adjustment', $6, $7, $7)
          returning id
        `,
        [
          access.budgetId,
          parsed.data.accountId,
          parsed.data.statementDate,
          differenceAmount,
          account.currency_id,
          parsed.data.memo || "Reconciliation adjustment",
          access.userId,
        ],
      );

      adjustmentTransactionId = transactionResult.rows[0].id;
      status = determineReconciliationStatus(differenceAmount, true);
    }

    await client.query(
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
      `,
      [
        access.budgetId,
        parsed.data.accountId,
        parsed.data.statementDate,
        parsed.data.statementBalance,
        computedBalance,
        differenceAmount,
        status,
        adjustmentTransactionId,
        parsed.data.memo || null,
        access.userId,
      ],
    );

    await client.query("commit");
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/reconciliation", "Failed to reconcile account."));
  } finally {
    client.release();
  }

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/reconciliation");
}
