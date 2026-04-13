import { previewCsvImport } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { requireBudgetAccess } from "@/lib/budget";
import { db } from "@/lib/db";

type ImportsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const access = await requireBudgetAccess();
  const [jobsResult, stagingResult, resolvedSearchParams] = await Promise.all([
    db.query<{
      id: string;
      original_filename: string;
      status: string;
      created_at: string;
      validation_summary_json: {
        rowCount?: number;
        headerCount?: number;
      } | null;
    }>(
      `
        select
          id,
          original_filename,
          status,
          created_at::text,
          validation_summary_json
        from import_jobs
        where budget_id = $1
        order by created_at desc
        limit 10
      `,
      [access.budgetId],
    ),
    db.query<{
      import_job_id: string;
      row_index: number;
      parsed_row_json: Record<string, string> | null;
    }>(
      `
        select import_job_id, row_index, parsed_row_json
        from import_staging_rows
        where import_job_id = (
          select id
          from import_jobs
          where budget_id = $1
          order by created_at desc
          limit 1
        )
        order by row_index asc
        limit 8
      `,
      [access.budgetId],
    ),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  return (
    <AppShell
      title="Imports"
      description="This is the first import slice: create an import job from raw CSV text, stage parsed rows, and preview the latest batch before mapping and commit logic are added."
      userDisplayName={access.displayName}
      budgetName={access.budgetName}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">Preview CSV import</h2>
          {resolvedSearchParams?.error ? (
            <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          <form action={previewCsvImport} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Filename label</span>
              <input
                required
                name="originalFilename"
                defaultValue="import.csv"
                className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">CSV text</span>
              <textarea
                required
                name="csvText"
                rows={14}
                placeholder={"date,amount,payee\n2026-04-01,-12.50,Coffee Shop"}
                className="w-full rounded-3xl border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-moss"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
            >
              Create preview job
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Recent import jobs</h2>
            <div className="mt-6 space-y-3">
              {jobsResult.rows.length > 0 ? (
                jobsResult.rows.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-ink/10 bg-paper/80 p-4">
                    <div className="text-sm uppercase tracking-[0.14em] text-ink/55">
                      {job.status} · {job.created_at.slice(0, 19).replace("T", " ")}
                    </div>
                    <div className="mt-2 text-lg text-ink">{job.original_filename}</div>
                    <div className="mt-2 text-sm text-ink/70">
                      Rows: {job.validation_summary_json?.rowCount ?? 0} · Headers:{" "}
                      {job.validation_summary_json?.headerCount ?? 0}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-6 text-sm text-ink/65">
                  No import jobs yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">Latest staging preview</h2>
            <div className="mt-6 overflow-hidden rounded-3xl border border-ink/10">
              <table className="min-w-full border-collapse bg-white text-left">
                <thead className="bg-ink text-paper">
                  <tr>
                    <th className="px-4 py-3 text-sm font-medium">Row</th>
                    <th className="px-4 py-3 text-sm font-medium">Parsed data</th>
                  </tr>
                </thead>
                <tbody>
                  {stagingResult.rows.length > 0 ? (
                    stagingResult.rows.map((row) => (
                      <tr key={`${row.import_job_id}-${row.row_index}`} className="border-t border-ink/10 align-top">
                        <td className="px-4 py-3">{row.row_index}</td>
                        <td className="px-4 py-3">
                          <pre className="whitespace-pre-wrap text-xs text-ink/80">
                            {JSON.stringify(row.parsed_row_json, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-ink/65" colSpan={2}>
                        No staged rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
