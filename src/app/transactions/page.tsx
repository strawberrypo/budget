import {
  createTransaction,
  updateTransaction,
  voidTransaction,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireBudgetAccess } from "@/lib/budget";
import { db } from "@/lib/db";
import { formatSignedMoney } from "@/lib/format";

type TransactionsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const access = await requireBudgetAccess();
  const [accountsResult, bucketsResult, transactionsResult, resolvedSearchParams] =
    await Promise.all([
      db.query<{
        id: string;
        name: string;
        currency_code: string;
      }>(
        `
          select a.id, a.name, c.code as currency_code
          from accounts a
          join currencies c on c.id = a.currency_id
          where a.budget_id = $1
            and a.is_closed = false
          order by a.name asc
        `,
        [access.budgetId],
      ),
      db.query<{
        id: string;
        category_name: string;
        group_name: string | null;
        currency_code: string;
      }>(
        `
          select
            ccb.id,
            c.name as category_name,
            cg.name as group_name,
            cur.code as currency_code
          from category_currency_buckets ccb
          join categories c on c.id = ccb.category_id
          left join category_groups cg on cg.id = c.category_group_id
          join currencies cur on cur.id = ccb.currency_id
          where ccb.budget_id = $1
            and ccb.is_active = true
            and c.is_hidden = false
          order by coalesce(cg.sort_order, 0), cg.name nulls first, c.name, cur.code
        `,
        [access.budgetId],
      ),
      db.query<{
        id: string;
        transaction_date: string;
        transaction_type: string;
        amount: string;
        account_id: string;
        category_currency_bucket_id: string | null;
        currency_code: string;
        account_name: string;
        payee_name_raw: string | null;
        memo: string | null;
        category_name: string | null;
      }>(
        `
          select
            t.id,
            t.transaction_date::text,
            t.transaction_type,
            t.amount::text,
            t.account_id,
            ts.category_currency_bucket_id,
            cur.code as currency_code,
            a.name as account_name,
            t.payee_name_raw,
            t.memo,
            c.name as category_name
          from transactions t
          join accounts a on a.id = t.account_id
          join currencies cur on cur.id = t.currency_id
          left join transaction_splits ts on ts.transaction_id = t.id
          left join category_currency_buckets ccb on ccb.id = ts.category_currency_bucket_id
          left join categories c on c.id = ccb.category_id
          where t.budget_id = $1
            and t.deleted_at is null
          order by t.transaction_date desc, t.created_at desc
          limit 20
        `,
        [access.budgetId],
      ),
      searchParams ? searchParams : Promise.resolve(undefined),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      title="Transactions"
      description="Manual transaction entry is the first core ledger workflow. Existing transactions can now be corrected or voided without direct database edits."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Add transaction</h2>
          {resolvedSearchParams?.error ? (
            <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          <form action={createTransaction} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Account</span>
              <select
                name="accountId"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                {accountsResult.rows.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency_code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Type</span>
              <select
                name="transactionType"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Date</span>
              <input
                required
                type="date"
                name="transactionDate"
                defaultValue={today}
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Amount</span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                name="amount"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Category bucket</span>
              <select
                name="categoryCurrencyBucketId"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                <option value="">None</option>
                {bucketsResult.rows.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.group_name ? `${bucket.group_name} / ` : ""}
                    {bucket.category_name} ({bucket.currency_code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Payee</span>
              <input
                name="payeeNameRaw"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Memo</span>
              <input
                name="memo"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
            >
              Save transaction
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Recent activity</h2>
          <div className="mt-6 space-y-4">
            {transactionsResult.rows.length > 0 ? (
              transactionsResult.rows.map((transaction) => (
                <div key={transaction.id} className="rounded-3xl border border-ink/10 bg-paper/85 p-5">
                  <form action={updateTransaction} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Date</span>
                      <input
                        required
                        type="date"
                        name="transactionDate"
                        defaultValue={transaction.transaction_date}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Account</span>
                      <select
                        name="accountId"
                        defaultValue={transaction.account_id}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      >
                        {accountsResult.rows.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.currency_code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Type</span>
                      <select
                        name="transactionType"
                        defaultValue={transaction.transaction_type}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="adjustment">Adjustment</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Amount</span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        name="amount"
                        defaultValue={Math.abs(Number(transaction.amount))}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Category bucket</span>
                      <select
                        name="categoryCurrencyBucketId"
                        defaultValue={transaction.category_currency_bucket_id ?? ""}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      >
                        <option value="">None</option>
                        {bucketsResult.rows.map((bucket) => (
                          <option key={bucket.id} value={bucket.id}>
                            {bucket.group_name ? `${bucket.group_name} / ` : ""}
                            {bucket.category_name} ({bucket.currency_code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Payee</span>
                      <input
                        name="payeeNameRaw"
                        defaultValue={transaction.payee_name_raw ?? ""}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Memo</span>
                      <input
                        name="memo"
                        defaultValue={transaction.memo ?? ""}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <div className="flex items-center justify-between md:col-span-2">
                      <div className="text-sm text-ink/70">
                        {transaction.account_name} · {transaction.category_name ?? "Ready to assign"} · {formatSignedMoney(transaction.amount, transaction.currency_code)}
                      </div>
                      <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper">
                        Update
                      </button>
                    </div>
                  </form>
                  <form action={voidTransaction} className="mt-3">
                    <input type="hidden" name="transactionId" value={transaction.id} />
                    <button type="submit" className="rounded-full border border-clay/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-clay">
                      Void transaction
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-ink/10 bg-white px-4 py-6 text-ink/65">
                No transactions yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
