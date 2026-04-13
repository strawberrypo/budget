"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, clearSession } from "@/lib/auth";
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
  csvImportSchema,
  setupSchema,
  transferSchema,
  transactionSchema,
  transactionUpdateSchema,
  transactionVoidSchema,
  reconciliationSchema,
} from "@/lib/forms";
import { db } from "@/lib/db";
import {
  ensureBudgetPeriod,
  ensureDefaultCurrencies,
  getBootstrapStatus,
  requireBudgetAccess,
} from "@/lib/budget";
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
} from "@/lib/workflows";
import { parseCsv, rowsToObjects } from "@/lib/csv";

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

    const bootstrapResult = await bootstrapBudget({
      db: client,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      password: parsed.data.password,
      budgetName: parsed.data.budgetName,
      reportingCurrencyId: parsed.data.reportingCurrencyId,
    });

    await client.query("commit");

    await createSession({
      userId: bootstrapResult.userId,
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

  await createAccountRecord({
    db,
    budgetId: access.budgetId,
    userId: access.userId,
    name: parsed.data.name,
    accountType: parsed.data.accountType,
    currencyId: parsed.data.currencyId,
    openingBalanceAmount: parsed.data.openingBalanceAmount,
    openingBalanceDate: parsed.data.openingBalanceDate,
  });

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

  await createCategoryGroupRecord({
    db,
    budgetId: access.budgetId,
    name: parsed.data.name,
  });

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
      categoryGroupId = await createCategoryGroupRecord({
        db: client,
        budgetId: access.budgetId,
        name: parsed.data.newGroupName,
      });
    }

    await createCategoryRecord({
      db: client,
      budgetId: access.budgetId,
      name: parsed.data.name,
      categoryGroupId,
      currencyIds: parsed.data.currencyIds,
    });

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
  const budgetPeriodId = await ensureBudgetPeriodFor({
    db,
    budgetId: access.budgetId,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });

  await createAssignmentEventRecord({
    db,
    budgetId: access.budgetId,
    userId: access.userId,
    budgetPeriodId,
    categoryCurrencyBucketId: parsed.data.categoryCurrencyBucketId,
    amountDelta: parsed.data.amountDelta,
    memo: parsed.data.memo || null,
  });

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

type UpsertTransactionParams = Omit<
  Parameters<typeof upsertTransactionRecord>[0],
  "db"
>;

async function upsertTransaction(params: UpsertTransactionParams) {
  const client = await db.connect();

  try {
    await client.query("begin");
    const result = await upsertTransactionRecord({
      ...params,
      db: client,
    });
    await client.query("commit");
    return result;
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
    await createTransferRecord({
      db: client,
      budgetId: access.budgetId,
      userId: access.userId,
      sourceAccountId: parsed.data.sourceAccountId,
      destinationAccountId: parsed.data.destinationAccountId,
      transferDate: parsed.data.transferDate,
      sourceAmount: parsed.data.sourceAmount,
      destinationAmount: parsed.data.destinationAmount,
      memo: parsed.data.memo || undefined,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    if (error instanceof Error && error.message === "Same currency mismatch") {
      redirectTo(
        normalizeErrorPath(
          "/transfers",
          "Same-currency transfers must preserve the amount exactly.",
        ),
      );
    }
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
    await reconcileAccountRecord({
      db: client,
      budgetId: access.budgetId,
      userId: access.userId,
      accountId: parsed.data.accountId,
      statementDate: parsed.data.statementDate,
      statementBalance: parsed.data.statementBalance,
      applyAdjustment: parsed.data.applyAdjustment === "yes",
      memo: parsed.data.memo || undefined,
    });

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

export async function previewCsvImport(formData: FormData) {
  const access = await requireBudgetAccess();
  const parsed = csvImportSchema.safeParse({
    csvText: formData.get("csvText"),
    originalFilename: formData.get("originalFilename"),
  });

  if (!parsed.success) {
    redirectTo(normalizeErrorPath("/imports", "Invalid CSV import input."));
  }

  const rows = parseCsv(parsed.data.csvText.trim());
  if (rows.length < 2) {
    redirectTo(
      normalizeErrorPath(
        "/imports",
        "CSV import needs a header row and at least one data row.",
      ),
    );
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((header, index) =>
    header.trim() === "" ? `column_${index + 1}` : header.trim(),
  );
  const objectRows = rowsToObjects(normalizedHeaders, dataRows);

  const client = await db.connect();

  try {
    await client.query("begin");

    const importJob = await client.query<{ id: string }>(
      `
        insert into import_jobs (
          budget_id,
          uploaded_by_user_id,
          source_type,
          original_filename,
          status,
          validation_summary_json
        )
        values ($1, $2, 'generic_csv', $3, 'previewed', $4)
        returning id
      `,
      [
        access.budgetId,
        access.userId,
        parsed.data.originalFilename,
        JSON.stringify({
          rowCount: objectRows.length,
          headerCount: normalizedHeaders.length,
        }),
      ],
    );

    for (let index = 0; index < objectRows.length; index += 1) {
      await client.query(
        `
          insert into import_staging_rows (
            import_job_id,
            row_index,
            raw_row_json,
            parsed_row_json,
            validation_status
          )
          values ($1, $2, $3, $4, 'preview')
        `,
        [
          importJob.rows[0].id,
          index + 1,
          JSON.stringify(objectRows[index]),
          JSON.stringify(objectRows[index]),
        ],
      );
    }

    await client.query("commit");
  } catch {
    await client.query("rollback");
    redirectTo(normalizeErrorPath("/imports", "Failed to create import preview."));
  } finally {
    client.release();
  }

  revalidatePath("/imports");
}
