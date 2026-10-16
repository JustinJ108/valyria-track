import { revalidatePath } from "next/cache";
import { refreshReport } from "@/lib/report";
import { hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let lastManualRun = 0;

// Marks the cached dashboard as out of date. With Neon, a fresh check is run and
// saved first; without it, the check runs when the page is next rebuilt.
async function refresh() {
  if (hasDb()) await refreshReport();
  revalidatePath("/");
}

// Vercel Cron calls this daily with "Authorization: Bearer $CRON_SECRET".
// It also loads the page once so the next visitor gets fresh results.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await refresh();
  await fetch(new URL("/", request.url), { cache: "no-store" }).catch(() => {});
  return Response.json({ ok: true, refreshedAt: new Date().toISOString() });
}

// "Run check now" button. Throttled so it can't be spammed.
export async function POST() {
  if (Date.now() - lastManualRun < 60_000)
    return Response.json({ error: "A check just ran — try again in a minute." }, { status: 429 });
  lastManualRun = Date.now();
  await refresh();
  return Response.json({ ok: true });
}
