import { reconcileAccount } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireBudgetAccess } from "@/lib/budget";
import { db } from "@/lib/db";
import { formatMoney, formatSignedMoney } from "@/lib/format";

type ReconciliationPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({
  searchParams,
}: ReconciliationPageProps) {
  const access = await requireBudgetAccess();
  const [accountsResult, eventsResult, resolvedSearchParams] = await Promise.all([
    db.query<{
      id: string;
      name: string;
      currency_code: string;
      computed_balance: string;
    }>(
      `
        select
          a.id,
          a.name,
          c.code as currency_code,
          (a.opening_balance_amount + coalesce(sum(t.amount), 0))::text as computed_balance
        from accounts a
        join currencies c on c.id = a.currency_id
        left join transactions t on t.account_id = a.id and t.deleted_at is null
        where a.budget_id = $1
          and a.is_closed = false
        group by a.id, c.code
        order by a.name asc
      `,
      [access.budgetId],
    ),
    db.query<{
      id: string;
      statement_date: string;
      statement_balance: string;
      computed_balance_at_time: string;
      difference_amount: string;
      status: string;
      account_name: string;
      currency_code: string;
    }>(
      `
        select
          re.id,
          re.statement_date::text,
          re.statement_balance::text,
          re.computed_balance_at_time::text,
          re.difference_amount::text,
          re.status,
          a.name as account_name,
          c.code as currency_code
        from reconciliation_events re
        join accounts a on a.id = re.account_id
        join currencies c on c.id = a.currency_id
        where re.budget_id = $1
        order by re.statement_date desc, re.created_at desc
        limit 20
      `,
      [access.budgetId],
    ),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      title="Reconciliation"
      description="Reconciliation compares a statement balance against the computed ledger balance. When needed, you can create an explicit adjustment transaction instead of silently rewriting balances."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Reconcile account</h2>
          {resolvedSearchParams?.error ? (
            <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          <form action={reconcileAccount} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Account</span>
              <select name="accountId" className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss">
                {accountsResult.rows.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency_code}) · Current {formatMoney(account.computed_balance, account.currency_code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Statement date</span>
              <input
                required
                type="date"
                name="statementDate"
                defaultValue={today}
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Statement balance</span>
              <input
                required
                type="number"
                step="0.01"
                name="statementBalance"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">If mismatched</span>
              <select
                name="applyAdjustment"
                defaultValue="no"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                <option value="no">Record review only</option>
                <option value="yes">Create explicit adjustment</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Notes</span>
              <input
                name="memo"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <button type="submit" className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss">
              Save reconciliation
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Recent reconciliation events</h2>
          <div className="mt-6 space-y-4">
            {eventsResult.rows.length > 0 ? (
              eventsResult.rows.map((event) => (
                <div key={event.id} className="rounded-3xl border border-ink/10 bg-paper/85 p-5">
                  <div className="text-sm uppercase tracking-[0.14em] text-ink/55">
                    {event.status} · {event.statement_date}
                  </div>
                  <div className="mt-2 text-lg text-ink">{event.account_name}</div>
                  <div className="mt-3 grid gap-2 text-sm text-ink/75">
                    <div>Statement: {formatMoney(event.statement_balance, event.currency_code)}</div>
                    <div>Computed: {formatMoney(event.computed_balance_at_time, event.currency_code)}</div>
                    <div>Difference: {formatSignedMoney(event.difference_amount, event.currency_code)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-ink/10 bg-white px-4 py-6 text-ink/65">
                No reconciliation events yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
