// Gets the report the dashboard shows: the latest stored run when Neon is
// configured, otherwise a live check memoized for a few minutes.
import { runCheck } from "./checker.js";
import { hasDb, latestRun, saveRun, history } from "./db.js";

let memo = null;
const MEMO_MS = 5 * 60 * 1000;

export async function getReport() {
  if (hasDb()) {
    let report = await latestRun();
    if (!report) {
      report = await runCheck();
      report.id = await saveRun(report);
    }
    return { report, history: await history(), stored: true };
  }
  if (!memo || Date.now() - memo.at > MEMO_MS) memo = { at: Date.now(), report: await runCheck() };
  return { report: memo.report, history: [], stored: false };
}

// Runs a fresh check now (dashboard button / cron).
export async function refreshReport() {
  const report = await runCheck();
  if (hasDb()) report.id = await saveRun(report);
  else memo = { at: Date.now(), report };
  return report;
}
