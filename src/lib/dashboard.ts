import { db } from "@/lib/db";
import type { DashboardSnapshot } from "@/lib/domain";

export async function getDashboardSnapshot(
  userId: string,
): Promise<DashboardSnapshot | null> {
  const membershipResult = await db.query<{
    user_id: string;
    display_name: string;
    budget_id: string;
    budget_name: string;
    reporting_currency_code: string | null;
  }>(
    `
      select
        u.id as user_id,
        u.display_name,
        b.id as budget_id,
        b.name as budget_name,
        rc.code as reporting_currency_code
      from budget_memberships bm
      join users u on u.id = bm.user_id
      join budgets b on b.id = bm.budget_id
      left join currencies rc on rc.id = b.default_reporting_currency_id
      where bm.user_id = $1
        and bm.is_active = true
        and b.is_archived = false
      order by bm.joined_at asc
      limit 1
    `,
    [userId],
  );

  const membership = membershipResult.rows[0];

  if (!membership) {
    return null;
  }

  const [accountsResult, readyResult] = await Promise.all([
    db.query<{
      id: string;
      name: string;
      account_type: DashboardSnapshot["accounts"][number]["type"];
      currency_code: DashboardSnapshot["accounts"][number]["currencyCode"];
      balance: string;
    }>(
      `
        select
          a.id,
          a.name,
          a.account_type,
          c.code as currency_code,
          (
            a.opening_balance_amount
            + coalesce(sum(t.amount), 0)
          )::text as balance
        from accounts a
        join currencies c on c.id = a.currency_id
        left join transactions t on t.account_id = a.id and t.deleted_at is null
        where a.budget_id = $1
          and a.is_closed = false
        group by a.id, c.code
        order by a.name asc
      `,
      [membership.budget_id],
    ),
    db.query<{
      currency_code: DashboardSnapshot["readyToAssignByCurrency"][number]["currencyCode"];
      amount: string;
    }>(
      `
        with inflow_by_currency as (
          select c.code as currency_code, coalesce(sum(t.amount), 0) as total
          from transactions t
          join accounts a on a.id = t.account_id
          join currencies c on c.id = a.currency_id
          where t.budget_id = $1
            and t.deleted_at is null
            and t.transaction_type in ('income', 'adjustment')
          group by c.code
        ),
        assigned_by_currency as (
          select c.code as currency_code, coalesce(sum(bae.amount_delta), 0) as total
          from budget_assignment_events bae
          join category_currency_buckets ccb on ccb.id = bae.category_currency_bucket_id
          join currencies c on c.id = ccb.currency_id
          where bae.budget_id = $1
          group by c.code
        )
        select
          coalesce(i.currency_code, a.currency_code) as currency_code,
          (coalesce(i.total, 0) - coalesce(a.total, 0))::text as amount
        from inflow_by_currency i
        full outer join assigned_by_currency a using (currency_code)
        order by currency_code asc
      `,
      [membership.budget_id],
    ),
  ]);

  return {
    user: {
      id: membership.user_id,
      displayName: membership.display_name,
    },
    budget: {
      id: membership.budget_id,
      name: membership.budget_name,
      reportingCurrencyCode:
        membership.reporting_currency_code as DashboardSnapshot["budget"]["reportingCurrencyCode"],
    },
    accounts: accountsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.account_type,
      currencyCode: row.currency_code,
      balance: row.balance,
    })),
    readyToAssignByCurrency: readyResult.rows.map((row) => ({
      currencyCode: row.currency_code,
      amount: row.amount,
    })),
  };
}
