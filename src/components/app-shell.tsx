import Link from "next/link";
import { ReactNode } from "react";
import { signOut } from "@/app/actions";

type AppShellProps = {
  title: string;
  description: string;
  userDisplayName: string;
  budgetName: string;
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/transactions", label: "Transactions" },
  { href: "/transfers", label: "Transfers" },
  { href: "/reconciliation", label: "Reconciliation" },
];

export function AppShell(props: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-clay">
              {props.budgetName}
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">
              {props.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
              {props.description}
            </p>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink/70">
            <div>Signed in as {props.userDisplayName}</div>
            <form action={signOut} className="mt-3">
              <button
                type="submit"
                className="rounded-full border border-ink/15 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mt-8">{props.children}</section>
    </main>
  );
}
