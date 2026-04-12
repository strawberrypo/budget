import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().default("Budget"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default("budget_session"),
  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(180),
});

export const env = envSchema.parse({
  APP_NAME: process.env.APP_NAME,
  APP_URL: process.env.APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
});
