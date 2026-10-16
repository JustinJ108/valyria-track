// Gets the report the dashboard shows. The page itself is cached by Next.js
// (see `revalidate` in app/page.js), so this only runs when the page is
// rebuilt: at most hourly, or when someone presses "Run check now".
import { runCheck } from "./checker.js";
import { hasDb, latestRun, saveRun, history } from "./db.js";

export const STALE_MS = 60 * 60 * 1000;

export async function getReport() {
  if (!hasDb()) return { report: await runCheck(), history: [], stored: false };

  let report = await latestRun();
  if (!report || Date.now() - new Date(report.checkedAt) > STALE_MS) report = await refreshReport();
  return { report, history: await history(), stored: true };
}

// Runs a fresh check and stores it when Neon is configured.
export async function refreshReport() {
  const report = await runCheck();
  if (hasDb()) report.id = await saveRun(report);
  return report;
}
