import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function hashToken(token: string) {
  return scryptSync(token, env.SESSION_SECRET, 64).toString("hex");
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(params: {
  userId: string;
  deviceLabel?: string;
}) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.SESSION_TTL_DAYS);

  await db.query(
    `
      insert into sessions (id, user_id, device_label, session_token_hash, expires_at)
      values (gen_random_uuid(), $1, $2, $3, $4)
    `,
    [params.userId, params.deviceLabel ?? null, tokenHash, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.query(
      `
        update sessions
        set revoked_at = now()
        where session_token_hash = $1
      `,
      [hashToken(token)],
    );
  }

  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const result = await db.query<{
    session_id: string;
    user_id: string;
    display_name: string;
  }>(
    `
      select
        s.id as session_id,
        u.id as user_id,
        u.display_name
      from sessions s
      join users u on u.id = s.user_id
      where s.session_token_hash = $1
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
        and u.is_active = true
      limit 1
    `,
    [tokenHash],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return result.rows[0];
});

export async function verifyPassword(input: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const candidate = scryptSync(input, salt, 64);
  const target = Buffer.from(key, "hex");

  return candidate.length === target.length && timingSafeEqual(candidate, target);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}
