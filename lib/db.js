// Neon storage. Everything here is optional: without DATABASE_URL the
// dashboard just runs a live check and skips history.
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

export const hasDb = () => Boolean(process.env.DATABASE_URL);
const db = () => neon(process.env.DATABASE_URL);

export async function initDb() {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  const sql = db();
  const statements = schema.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements)
    await sql.query(stmt);
}

export async function saveRun(report) {
  const sql = db();
  const s = report.summary;
  const [{ id }] = await sql`
    INSERT INTO check_runs (checked_at, source_sha, team_pct, project_pct, broken_links, missing_items, report)
    VALUES (${report.checkedAt}, ${report.source.sha}, ${s.teamPct}, ${s.projectPct}, ${s.brokenLinks}, ${s.missingItems}, ${JSON.stringify(report)})
    RETURNING id`;

  const rows = [
    ...report.team.map((r) => ["team", r]),
    ...report.projects.map((r) => ["project", r]),
  ].flatMap(([type, r]) =>
    Object.entries(r.fields).map(([field, f]) => ({
      run_id: id,
      entity_type: type,
      entity_name: r.name,
      field,
      status: f.status,
      url: f.url ?? null,
      http_code: f.httpCode ?? null,
      detail: f.detail ? String(f.detail).slice(0, 1000) : null,
    }))
  );
  await sql`
    INSERT INTO check_results
    SELECT * FROM json_populate_recordset(null::check_results, ${JSON.stringify(rows)}::json)`;
  return id;
}

export async function latestRun() {
  const rows = await db()`SELECT id, report FROM check_runs ORDER BY checked_at DESC LIMIT 1`;
  return rows[0] ? { id: rows[0].id, ...rows[0].report } : null;
}

export async function history(limit = 60) {
  const rows = await db()`
    SELECT id, checked_at, team_pct, project_pct, broken_links, missing_items
    FROM check_runs ORDER BY checked_at DESC LIMIT ${limit}`;
  return rows.reverse();
}
