import { closeAccount, createAccount, updateAccount } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { getActiveCurrencies, requireBudgetAccess } from "@/lib/budget";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const access = await requireBudgetAccess();
  const [currencies, accountsResult] = await Promise.all([
    getActiveCurrencies(),
    db.query<{
      id: string;
      name: string;
      currency_id: string;
      account_type: string;
      currency_code: string;
      balance: string;
      opening_balance_amount: string;
      opening_balance_date: string;
    }>(
      `
        select
          a.id,
          a.name,
          a.currency_id,
          a.account_type,
          c.code as currency_code,
          (a.opening_balance_amount + coalesce(sum(t.amount), 0))::text as balance,
          a.opening_balance_amount::text,
          a.opening_balance_date::text
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
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      title="Accounts"
      description="Accounts are where money lives. Each account has one native currency, and balances derive from opening balance plus ledger activity."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Add account</h2>
          <form action={createAccount} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Name</span>
              <input
                required
                name="name"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Type</span>
              <select
                name="accountType"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Currency</span>
              <select
                name="currencyId"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code} · {currency.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Opening balance</span>
              <input
                required
                type="number"
                step="0.01"
                name="openingBalanceAmount"
                defaultValue="0"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Opening balance date</span>
              <input
                required
                type="date"
                name="openingBalanceDate"
                defaultValue={today}
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
            >
              Save account
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Current accounts</h2>
          <div className="mt-6 space-y-4">
            {accountsResult.rows.length ? (
              accountsResult.rows.map((account) => (
                <div
                  key={account.id}
                  className="rounded-3xl border border-ink/10 bg-paper/85 p-5"
                >
                  <form action={updateAccount} className="grid gap-4 lg:grid-cols-5">
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="currencyId" value={account.currency_id} />
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
                        Name
                      </span>
                      <input
                        required
                        name="name"
                        defaultValue={account.name}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
                        Type
                      </span>
                      <select
                        name="accountType"
                        defaultValue={account.account_type}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      >
                        <option value="checking">Checking</option>
                        <option value="savings">Savings</option>
                        <option value="cash">Cash</option>
                        <option value="credit">Credit</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
                        Opening balance
                      </span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        name="openingBalanceAmount"
                        defaultValue={account.opening_balance_amount}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
                        Opened
                      </span>
                      <input
                        required
                        type="date"
                        name="openingBalanceDate"
                        defaultValue={account.opening_balance_date}
                        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                    </label>
                    <div className="flex flex-col justify-end gap-2">
                      <div className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                        {account.currency_code} · {formatMoney(account.balance, account.currency_code)}
                      </div>
                      <button
                        type="submit"
                        className="rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-moss"
                      >
                        Update
                      </button>
                    </div>
                  </form>
                  <form action={closeAccount} className="mt-3">
                    <input type="hidden" name="accountId" value={account.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-clay/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-clay transition hover:bg-clay hover:text-paper"
                    >
                      Close account
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-ink/10 bg-white px-4 py-6 text-ink/65">
                No account data yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
