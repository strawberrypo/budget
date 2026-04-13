import { completeSetup } from "@/app/actions";
import {
  ensureDefaultCurrencies,
  getActiveCurrencies,
  getBootstrapStatus,
} from "@/lib/budget";
import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";

function redirectTo(path: string): never {
  redirect(path as never);
}

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  await ensureDefaultCurrencies();

  const [bootstrap, session, currencies, resolvedSearchParams] = await Promise.all([
    getBootstrapStatus(),
    getCurrentSession(),
    getActiveCurrencies(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  if (bootstrap.isBootstrapped) {
    if (session) {
      redirectTo("/");
    }

    redirectTo("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-lg">
          <div className="text-sm uppercase tracking-[0.24em] text-clay">
            Initial setup
          </div>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink">
            Create the first trusted owner and budget.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-ink/75">
            This replaces manual SQL bootstrapping. The first account created
            here becomes the owner of the initial shared household budget.
          </p>
          <div className="mt-8 grid gap-4 text-sm leading-7 text-ink/75">
            <div>Local-first deployment over LAN or Tailscale</div>
            <div>Persistent sign-in on trusted devices</div>
            <div>Budgeting kept separate by currency from day one</div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-lg">
          {resolvedSearchParams?.error ? (
            <div className="rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
              {resolvedSearchParams.error}
            </div>
          ) : null}

          <form action={completeSetup} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Owner name
              </span>
              <input
                required
                name="displayName"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Email</span>
              <input
                required
                type="email"
                name="email"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Password
              </span>
              <input
                required
                type="password"
                name="password"
                minLength={8}
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Budget name
              </span>
              <input
                required
                name="budgetName"
                defaultValue="Household Budget"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Reporting currency
              </span>
              <select
                required
                name="reportingCurrencyId"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code} · {currency.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
            >
              Create owner and budget
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
