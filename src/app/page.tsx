import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/dashboard";

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
  const session = await getCurrentSession();
  const dashboard = session
    ? await getDashboardSnapshot(session.user_id)
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <section className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm uppercase tracking-[0.28em] text-clay">
              Self-hosted household budgeting
            </div>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink">
              Local-first budgeting built for shared real-world money.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-ink/75">
              The first slice focuses on a server-centered home deployment,
              currency-separated budgeting, and durable ledger primitives.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-full border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            >
              Sign in
            </Link>
            <Link
              href="/accounts"
              className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
            >
              View accounts
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
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

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[2rem] border border-ink/10 bg-white/70 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Current scaffold</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-ink/75">
            <div>App Router shell with typed server-side modules</div>
            <div>PostgreSQL schema for users, sessions, budgets, ledger, and imports</div>
            <div>Starter dashboard query model for balances and ready-to-assign by currency</div>
            <div>Compose stack with app, database, and rotating backup job</div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-paper shadow-sm">
          <h2 className="text-2xl font-semibold">Status</h2>
          {dashboard ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-paper/60">
                  Signed in as
                </div>
                <div className="mt-1 text-xl">{dashboard.user.displayName}</div>
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-paper/60">
                  Budget
                </div>
                <div className="mt-1 text-xl">{dashboard.budget.name}</div>
              </div>
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-paper/60">
                  Ready to assign
                </div>
                <div className="mt-2 space-y-2">
                  {dashboard.readyToAssignByCurrency.length > 0 ? (
                    dashboard.readyToAssignByCurrency.map((item) => (
                      <div
                        key={item.currencyCode}
                        className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                      >
                        <span>{item.currencyCode}</span>
                        <span>{item.amount}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-paper/75">
                      No budget activity yet. Seed data will populate the first view.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 max-w-sm text-sm leading-7 text-paper/75">
              No active session yet. After seeding the database, sign in with the
              bootstrap owner account to view the initial dashboard.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
