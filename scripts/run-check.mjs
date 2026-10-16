// Runs the checker from the command line: `npm run check` (add --save to store in Neon).
import { runCheck } from "../lib/checker.js";
const report = await runCheck();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const icon = { ok: "✓", warn: "⚠", unverified: "?", broken: "✗!", missing: "✗" };
  for (const group of ["team", "projects"]) {
    console.log(`\n== ${group} ==`);
    for (const row of report[group]) {
      const cells = Object.entries(row.fields).map(([k, f]) => `${k}:${icon[f.status]}`).join("  ");
      console.log(row.name.padEnd(28), cells);
    }
  }
  console.log("\n== problems ==");
  for (const row of [...report.team, ...report.projects])
    for (const [k, f] of Object.entries(row.fields))
      if (f.url && f.status !== "ok") console.log(`[${f.status}] ${row.name} / ${k}: ${f.detail} — ${f.url}`);
  console.log("\nsummary", JSON.stringify({ ...report.summary, team: undefined, projects: undefined }));
}
if (process.argv.includes("--save")) {
  const { saveRun } = await import("../lib/db.js");
  console.log("saved run", await saveRun(report));
}
