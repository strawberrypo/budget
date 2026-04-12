import { redirect } from "next/navigation";
import { createSession, getCurrentSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const result = await db.query<{
    id: string;
    password_hash: string;
  }>(
    `
      select id, password_hash
      from users
      where lower(email) = $1
        and is_active = true
      limit 1
    `,
    [email],
  );

  const user = result.rows[0];
  if (!user) {
    redirect("/login?error=invalid");
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    redirect("/login?error=invalid");
  }

  await createSession({
    userId: user.id,
    deviceLabel: "browser",
  });

  redirect("/");
}

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-ink/10 bg-white/80 p-8 shadow-lg backdrop-blur">
        <div className="text-sm uppercase tracking-[0.22em] text-clay">
          Trusted-device access
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          v1 keeps auth intentionally lightweight for a private home deployment.
        </p>
        {resolvedSearchParams?.error === "invalid" ? (
          <div className="mt-4 rounded-2xl border border-clay/20 bg-clay/10 px-4 py-3 text-sm text-clay">
            Invalid credentials.
          </div>
        ) : null}

        <form action={signIn} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Email</span>
            <input
              required
              type="email"
              name="email"
              className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none transition focus:border-moss"
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
              className="w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 outline-none transition focus:border-moss"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-moss"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
