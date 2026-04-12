import { Pool } from "pg";
import { env } from "@/lib/env";

declare global {
  var __budgetPool: Pool | undefined;
}

export const db =
  global.__budgetPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__budgetPool = db;
}
