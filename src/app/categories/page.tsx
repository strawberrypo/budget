import {
  assignBudgetMoney,
  createCategory,
  createCategoryGroup,
  hideCategory,
  hideCategoryGroup,
  reverseAssignmentEvent,
  updateCategory,
  updateCategoryGroup,
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import {
  ensureBudgetPeriod,
  getActiveCurrencies,
  requireBudgetAccess,
} from "@/lib/budget";
import { db } from "@/lib/db";
import { formatMoney, formatSignedMoney } from "@/lib/format";

type CategoriesPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const access = await requireBudgetAccess();
  const current = new Date();
  const budgetPeriodId = await ensureBudgetPeriod({
    budgetId: access.budgetId,
    year: current.getUTCFullYear(),
    month: current.getUTCMonth() + 1,
  });

  const [
    currencies,
    groupResult,
    categoryResult,
    bucketResult,
    assignmentEventsResult,
    resolvedSearchParams,
  ] = await Promise.all([
    getActiveCurrencies(),
    db.query<{ id: string; name: string }>(
      `
        select id, name
        from category_groups
        where budget_id = $1
          and is_hidden = false
        order by sort_order asc, name asc
      `,
      [access.budgetId],
    ),
    db.query<{
      id: string;
      name: string;
      category_group_id: string | null;
    }>(
      `
        select id, name, category_group_id
        from categories
        where budget_id = $1
          and is_hidden = false
        order by sort_order asc, name asc
      `,
      [access.budgetId],
    ),
    db.query<{
      bucket_id: string;
      category_name: string;
      group_name: string | null;
      currency_code: string;
      assigned: string;
      activity: string;
      available: string;
    }>(
      `
        select
          ccb.id as bucket_id,
          c.name as category_name,
          cg.name as group_name,
          cur.code as currency_code,
          coalesce((
            select sum(bae.amount_delta)
            from budget_assignment_events bae
            where bae.category_currency_bucket_id = ccb.id
              and bae.budget_period_id = $2
          ), 0)::text as assigned,
          coalesce((
            select sum(ts.amount)
            from transaction_splits ts
            join transactions t on t.id = ts.transaction_id
            where ts.category_currency_bucket_id = ccb.id
              and t.deleted_at is null
              and date_trunc('month', t.transaction_date::timestamp)
                  = date_trunc('month', current_date::timestamp)
          ), 0)::text as activity,
          (
            coalesce((
              select sum(bae.amount_delta)
              from budget_assignment_events bae
              where bae.category_currency_bucket_id = ccb.id
                and bae.budget_period_id = $2
            ), 0)
            +
            coalesce((
              select sum(ts.amount)
              from transaction_splits ts
              join transactions t on t.id = ts.transaction_id
              where ts.category_currency_bucket_id = ccb.id
                and t.deleted_at is null
                and date_trunc('month', t.transaction_date::timestamp)
                    = date_trunc('month', current_date::timestamp)
            ), 0)
          )::text as available
        from category_currency_buckets ccb
        join categories c on c.id = ccb.category_id
        left join category_groups cg on cg.id = c.category_group_id
        join currencies cur on cur.id = ccb.currency_id
        where ccb.budget_id = $1
          and ccb.is_active = true
          and c.is_hidden = false
        order by coalesce(cg.sort_order, 0), cg.name nulls first, c.sort_order, c.name, cur.code
      `,
      [access.budgetId, budgetPeriodId],
    ),
    db.query<{
      id: string;
      amount_delta: string;
      event_type: string;
      created_at: string;
      memo: string | null;
      category_name: string;
      currency_code: string;
    }>(
      `
        select
          bae.id,
          bae.amount_delta::text,
          bae.event_type,
          bae.created_at::text,
          bae.memo,
          c.name as category_name,
          cur.code as currency_code
        from budget_assignment_events bae
        join category_currency_buckets ccb on ccb.id = bae.category_currency_bucket_id
        join categories c on c.id = ccb.category_id
        join currencies cur on cur.id = ccb.currency_id
        where bae.budget_id = $1
        order by bae.created_at desc
        limit 12
      `,
      [access.budgetId],
    ),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  return (
    <AppShell
      title="Categories"
      description="Categories are conceptual envelopes. Each active category has one or more explicit currency buckets, and assignment corrections are tracked as explicit reversals."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Add group</h2>
            <form action={createCategoryGroup} className="mt-6 flex gap-3">
              <input
                required
                name="name"
                placeholder="Fixed expenses"
                className="flex-1 rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
              <button
                type="submit"
                className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
              >
                Save
              </button>
            </form>
          </section>

          {groupResult.rows.length > 0 ? (
            <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-ink">Edit groups</h2>
              <div className="mt-6 space-y-3">
                {groupResult.rows.map((group) => (
                  <div key={group.id} className="rounded-2xl border border-ink/10 bg-paper/80 p-4">
                    <form action={updateCategoryGroup} className="flex gap-3">
                      <input type="hidden" name="groupId" value={group.id} />
                      <input
                        required
                        name="name"
                        defaultValue={group.name}
                        className="flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                      <button type="submit" className="rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper">
                        Update
                      </button>
                    </form>
                    <form action={hideCategoryGroup} className="mt-3">
                      <input type="hidden" name="groupId" value={group.id} />
                      <button type="submit" className="rounded-full border border-clay/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-clay">
                        Hide group
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Add category</h2>
            {resolvedSearchParams?.error ? (
              <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
                {resolvedSearchParams.error}
              </div>
            ) : null}
            <form action={createCategory} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Name</span>
                <input
                  required
                  name="name"
                  className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Existing group</span>
                <select
                  name="categoryGroupId"
                  className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
                >
                  <option value="">No group</option>
                  {groupResult.rows.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Or create a new group</span>
                <input
                  name="newGroupName"
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
                />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Active currency buckets</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currencies.map((currency) => (
                    <label
                      key={currency.id}
                      className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink"
                    >
                      <input type="checkbox" name="currencyIds" value={currency.id} />
                      <span>{currency.code} · {currency.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
              >
                Save category
              </button>
            </form>
          </section>

          {categoryResult.rows.length > 0 ? (
            <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-ink">Edit categories</h2>
              <div className="mt-6 space-y-3">
                {categoryResult.rows.map((category) => (
                  <div key={category.id} className="rounded-2xl border border-ink/10 bg-paper/80 p-4">
                    <form action={updateCategory} className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input
                        required
                        name="name"
                        defaultValue={category.name}
                        className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      />
                      <select
                        name="categoryGroupId"
                        defaultValue={category.category_group_id ?? ""}
                        className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-moss"
                      >
                        <option value="">No group</option>
                        {groupResult.rows.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper">
                        Update
                      </button>
                    </form>
                    <form action={hideCategory} className="mt-3">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button type="submit" className="rounded-full border border-clay/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-clay">
                        Hide category
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Assign this month</h2>
            <form action={assignBudgetMoney} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Category bucket</span>
                <select
                  name="categoryCurrencyBucketId"
                  className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
                >
                  {bucketResult.rows.map((bucket) => (
                    <option key={bucket.bucket_id} value={bucket.bucket_id}>
                      {bucket.group_name ? `${bucket.group_name} / ` : ""}
                      {bucket.category_name} ({bucket.currency_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Amount delta</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  name="amountDelta"
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
                Record assignment event
              </button>
            </form>
          </section>

          {assignmentEventsResult.rows.length > 0 ? (
            <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-ink">Recent assignment events</h2>
              <div className="mt-6 space-y-3">
                {assignmentEventsResult.rows.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-ink/10 bg-paper/80 p-4">
                    <div className="text-sm text-ink">
                      {event.category_name} ({event.currency_code}) · {formatSignedMoney(event.amount_delta, event.currency_code)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/55">
                      {event.event_type} · {event.created_at.slice(0, 10)}
                    </div>
                    {event.memo ? (
                      <div className="mt-2 text-sm text-ink/65">{event.memo}</div>
                    ) : null}
                    <form action={reverseAssignmentEvent} className="mt-3">
                      <input type="hidden" name="assignmentEventId" value={event.id} />
                      <button type="submit" className="rounded-full border border-clay/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-clay">
                        Reverse event
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Category buckets</h2>
          <div className="mt-6 overflow-hidden rounded-3xl border border-ink/10">
            <table className="min-w-full border-collapse bg-white text-left">
              <thead className="bg-ink text-paper">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium">Group</th>
                  <th className="px-4 py-3 text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-sm font-medium">Currency</th>
                  <th className="px-4 py-3 text-sm font-medium">Assigned</th>
                  <th className="px-4 py-3 text-sm font-medium">Activity</th>
                  <th className="px-4 py-3 text-sm font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {bucketResult.rows.length > 0 ? (
                  bucketResult.rows.map((bucket) => (
                    <tr key={bucket.bucket_id} className="border-t border-ink/10">
                      <td className="px-4 py-3 text-ink/65">{bucket.group_name ?? "Ungrouped"}</td>
                      <td className="px-4 py-3">{bucket.category_name}</td>
                      <td className="px-4 py-3">{bucket.currency_code}</td>
                      <td className="px-4 py-3">{formatSignedMoney(bucket.assigned, bucket.currency_code)}</td>
                      <td className="px-4 py-3">{formatSignedMoney(bucket.activity, bucket.currency_code)}</td>
                      <td className="px-4 py-3">{formatMoney(bucket.available, bucket.currency_code)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-ink/65" colSpan={6}>
                      No categories yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
