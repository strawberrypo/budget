import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireBudgetAccess } from "@/lib/budget";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { formatMoney, formatSignedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

function MetricCard(props: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-amber/30 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="text-sm uppercase tracking-[0.18em] text-ink/60">
        {props.label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-ink">{props.value}</div>
      {props.detail ? (
        <div className="mt-1 text-sm text-ink/65">{props.detail}</div>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const access = await requireBudgetAccess();
  const dashboard = await getDashboardSnapshot(access.userId);

  if (!dashboard) {
    return null;
  }

  return (
    <AppShell
      title="Overview"
      description="This is the first real server-backed slice: setup, accounts, category buckets, monthly assignment events, and manual transaction entry."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Deployment"
          value="Next.js + Postgres"
          detail="Docker Compose on a private LAN or Tailscale network"
        />
        <MetricCard
          label="Budget model"
          value="Envelope by currency"
          detail="Assignments and category balances stay native"
        />
        <MetricCard
          label="Auth"
          value="Persistent sessions"
          detail="Simple trusted-device access for a home server"
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[2rem] border border-ink/10 bg-white/70 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Current status</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-ink/75">
            <div>Use Accounts to add checking, savings, cash, or credit-style ledgers.</div>
            <div>Use Categories to create conceptual envelopes with explicit currency buckets.</div>
            <div>Use Transactions to record income, expenses, and balance adjustments.</div>
            <div>Budget assignment events are tracked append-only for the current month.</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/accounts"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-moss"
            >
              Add account
            </Link>
            <Link
              href="/categories"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            >
              Manage categories
            </Link>
            <Link
              href="/transactions"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            >
              Enter transaction
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-paper shadow-sm">
          <h2 className="text-2xl font-semibold">Ready to assign</h2>
          <div className="mt-4 space-y-3">
            {dashboard.readyToAssignByCurrency.length > 0 ? (
              dashboard.readyToAssignByCurrency.map((item) => (
                <div
                  key={item.currencyCode}
                  className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                >
                  <span>{item.currencyCode}</span>
                  <span>{formatSignedMoney(item.amount, item.currencyCode)}</span>
                </div>
              ))
            ) : (
              <div className="text-paper/75">
                No budget activity yet. Create an account, category bucket, and first transaction.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-ink">Accounts snapshot</h2>
          <Link href="/accounts" className="text-sm font-medium text-clay">
            View all
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {dashboard.accounts.length > 0 ? (
            dashboard.accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-3xl border border-ink/10 bg-paper/80 p-5"
              >
                <div className="text-sm uppercase tracking-[0.18em] text-ink/55">
                  {account.type}
                </div>
                <div className="mt-2 text-2xl font-semibold text-ink">
                  {account.name}
                </div>
                <div className="mt-1 text-sm text-ink/65">{account.currencyCode}</div>
                <div className="mt-4 text-lg text-ink">
                  {formatMoney(account.balance, account.currencyCode)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-ink/15 bg-paper/70 p-5 text-sm text-ink/65">
              No accounts yet.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
