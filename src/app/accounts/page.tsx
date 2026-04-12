import { getCurrentSession } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/dashboard";

export default async function AccountsPage() {
  const session = await getCurrentSession();
  const dashboard = session ? await getDashboardSnapshot(session.user_id) : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-8 shadow-lg">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          Accounts
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
          Accounts are currency-native and balances derive from opening balance
          plus ledger activity.
        </p>

        <div className="mt-8 overflow-hidden rounded-3xl border border-ink/10">
          <table className="min-w-full border-collapse bg-white text-left">
            <thead className="bg-ink text-paper">
              <tr>
                <th className="px-4 py-3 text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-sm font-medium">Currency</th>
                <th className="px-4 py-3 text-sm font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.accounts.length ? (
                dashboard.accounts.map((account) => (
                  <tr key={account.id} className="border-t border-ink/10">
                    <td className="px-4 py-3">{account.name}</td>
                    <td className="px-4 py-3 capitalize">{account.type}</td>
                    <td className="px-4 py-3">{account.currencyCode}</td>
                    <td className="px-4 py-3">{account.balance}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-ink/65" colSpan={4}>
                    No account data yet. Load the seed dataset or sign in first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
