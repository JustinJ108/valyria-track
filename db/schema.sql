-- One row per check. The full report is kept as JSON so the dashboard can
-- re-render any past run; the summary columns make the history chart cheap.
CREATE TABLE IF NOT EXISTS check_runs (
  id            SERIAL PRIMARY KEY,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_sha    TEXT,
  team_pct      INTEGER NOT NULL,
  project_pct   INTEGER NOT NULL,
  broken_links  INTEGER NOT NULL,
  missing_items INTEGER NOT NULL,
  report        JSONB NOT NULL
);

-- One row per field per entity, so you can query e.g. "every broken link"
-- or "when did Roo's live link start failing" straight from the Neon console.
CREATE TABLE IF NOT EXISTS check_results (
  run_id      INTEGER NOT NULL REFERENCES check_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,          -- 'team' | 'project'
  entity_name TEXT NOT NULL,
  field       TEXT NOT NULL,
  status      TEXT NOT NULL,          -- ok | warn | unverified | broken | missing
  url         TEXT,
  http_code   INTEGER,
  detail      TEXT,
  PRIMARY KEY (run_id, entity_type, entity_name, field)
);

CREATE INDEX IF NOT EXISTS check_results_status_idx ON check_results (status);
