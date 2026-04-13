import { createTransfer } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { TransferForm } from "@/components/transfer-form";
import { requireBudgetAccess } from "@/lib/budget";
import { db } from "@/lib/db";
import { formatSignedMoney } from "@/lib/format";

type TransfersPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TransfersPage({
  searchParams,
}: TransfersPageProps) {
  const access = await requireBudgetAccess();
  const [accountsResult, transfersResult, resolvedSearchParams] = await Promise.all([
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
      transfer_date: string;
      transfer_kind: string;
      memo: string | null;
      source_account_name: string;
      destination_account_name: string;
      source_amount: string;
      source_currency_code: string;
      destination_amount: string;
      destination_currency_code: string;
    }>(
      `
        select
          tr.id,
          tr.transfer_date::text,
          tr.transfer_kind,
          tr.memo,
          sa.name as source_account_name,
          da.name as destination_account_name,
          ol.amount::text as source_amount,
          sc.code as source_currency_code,
          il.amount::text as destination_amount,
          dc.code as destination_currency_code
        from transfers tr
        join accounts sa on sa.id = tr.source_account_id
        join accounts da on da.id = tr.destination_account_id
        join transfer_legs ol on ol.transfer_id = tr.id and ol.leg_direction = 'outflow'
        join transfer_legs il on il.transfer_id = tr.id and il.leg_direction = 'inflow'
        join currencies sc on sc.id = ol.currency_id
        join currencies dc on dc.id = il.currency_id
        where tr.budget_id = $1
          and tr.deleted_at is null
        order by tr.transfer_date desc, tr.created_at desc
        limit 20
      `,
      [access.budgetId],
    ),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      title="Transfers"
      description="Transfers explicitly link movement between accounts. Cross-currency transfers preserve both native amounts and store derived exchange context."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Add transfer</h2>
          {resolvedSearchParams?.error ? (
            <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          <TransferForm
            accounts={accountsResult.rows.map((account) => ({
              id: account.id,
              name: account.name,
              currencyCode: account.currency_code,
            }))}
            defaultDate={today}
          />
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Recent transfers</h2>
          <div className="mt-6 space-y-4">
            {transfersResult.rows.length > 0 ? (
              transfersResult.rows.map((transfer) => (
                <div key={transfer.id} className="rounded-3xl border border-ink/10 bg-paper/85 p-5">
                  <div className="text-sm uppercase tracking-[0.14em] text-ink/55">
                    {transfer.transfer_kind} · {transfer.transfer_date}
                  </div>
                  <div className="mt-2 text-lg text-ink">
                    {transfer.source_account_name} to {transfer.destination_account_name}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-ink/75">
                    <div>
                      Outflow: {formatSignedMoney(`-${transfer.source_amount}`, transfer.source_currency_code)}
                    </div>
                    <div>
                      Inflow: {formatSignedMoney(transfer.destination_amount, transfer.destination_currency_code)}
                    </div>
                    {transfer.memo ? <div>Memo: {transfer.memo}</div> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-ink/10 bg-white px-4 py-6 text-ink/65">
                No transfers yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
