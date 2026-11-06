import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/clinic/reminders";

/** Called by Vercel Cron (Authorization: Bearer $CRON_SECRET) or any scheduler with the same header. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  const okAuth = !!secret && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!okAuth) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runReminders()) }, { headers: { "Cache-Control": "no-store" } });
}
