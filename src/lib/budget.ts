import { redirect } from "next/navigation";
import { cache } from "react";
import type { Pool, PoolClient } from "pg";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

export type BudgetAccess = {
  userId: string;
  displayName: string;
  budgetId: string;
  budgetName: string;
};

function redirectTo(path: string): never {
  redirect(path as never);
}

export const getBootstrapStatus = cache(async () => {
  const result = await db.query<{
    user_count: string;
    budget_count: string;
  }>(
    `
      select
        (select count(*)::text from users) as user_count,
        (select count(*)::text from budgets) as budget_count
    `,
  );

  const row = result.rows[0];
  return {
    userCount: Number(row?.user_count ?? 0),
    budgetCount: Number(row?.budget_count ?? 0),
    isBootstrapped:
      Number(row?.user_count ?? 0) > 0 && Number(row?.budget_count ?? 0) > 0,
  };
});

export async function requireBudgetAccess(): Promise<BudgetAccess> {
  const bootstrap = await getBootstrapStatus();

  if (!bootstrap.isBootstrapped) {
    redirectTo("/setup");
  }

  const session = await getCurrentSession();

  if (!session) {
    redirectTo("/login");
  }

  const result = await db.query<{
    user_id: string;
    display_name: string;
    budget_id: string;
    budget_name: string;
  }>(
    `
      select
        u.id as user_id,
        u.display_name,
        b.id as budget_id,
        b.name as budget_name
      from budget_memberships bm
      join users u on u.id = bm.user_id
      join budgets b on b.id = bm.budget_id
      where bm.user_id = $1
        and bm.is_active = true
        and b.is_archived = false
      order by bm.joined_at asc
      limit 1
    `,
    [session.user_id],
  );

  const membership = result.rows[0];

  if (!membership) {
    redirectTo("/setup");
  }

  return {
    userId: membership.user_id,
    displayName: membership.display_name,
    budgetId: membership.budget_id,
    budgetName: membership.budget_name,
  };
}

export async function getActiveCurrencies() {
  const result = await db.query<{
    id: string;
    code: string;
    name: string;
    symbol: string;
    decimal_places: number;
  }>(
    `
      select id, code, name, symbol, decimal_places
      from currencies
      where is_active = true
      order by code asc
    `,
  );

  return result.rows;
}

export async function ensureDefaultCurrencies(client: Pool | PoolClient = db) {
  await client.query(
    `
      insert into currencies (code, name, symbol, decimal_places)
      values
        ('USD', 'US Dollar', '$', 2),
        ('KRW', 'South Korean Won', '₩', 0),
        ('EUR', 'Euro', '€', 2),
        ('JPY', 'Japanese Yen', '¥', 0)
      on conflict (code) do nothing
    `,
  );
}

export async function ensureBudgetPeriod(params: {
  budgetId: string;
  year: number;
  month: number;
}) {
  const periodStart = new Date(Date.UTC(params.year, params.month - 1, 1));
  const periodEnd = new Date(Date.UTC(params.year, params.month, 0));
  const label = `${params.year}-${String(params.month).padStart(2, "0")}`;

  const result = await db.query<{ id: string }>(
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

  return result.rows[0]?.id;
}
