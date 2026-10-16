import { refreshReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let lastManualRun = 0;

function summaryOf(report) {
  const { team, projects, ...rest } = report.summary;
  return { checkedAt: report.checkedAt, id: report.id ?? null, ...rest };
}

// Vercel Cron calls this daily with "Authorization: Bearer $CRON_SECRET".
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(summaryOf(await refreshReport()));
}

// "Run check now" button on the dashboard. Throttled so it can't be spammed.
export async function POST() {
  if (Date.now() - lastManualRun < 60_000)
    return Response.json({ error: "A check just ran — try again in a minute." }, { status: 429 });
  lastManualRun = Date.now();
  return Response.json(summaryOf(await refreshReport()));
}
