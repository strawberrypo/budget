import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.query("select 1");

    return NextResponse.json({
      ok: true,
      database: "reachable",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
