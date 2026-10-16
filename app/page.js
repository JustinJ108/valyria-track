import { getReport } from "@/lib/report";
import { TEAM_FIELDS, PROJECT_FIELDS } from "@/lib/checker";
import StatusCell, { Legend, STATUS_META } from "@/components/StatusCell";
import RunCheckButton from "@/components/RunCheckButton";
import HistoryChart from "@/components/HistoryChart";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ISSUE_ORDER = { broken: 0, warn: 1, unverified: 2 };

function Tile({ label, value, sub, pct }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {pct != null && <div className="meter"><span style={{ width: `${pct}%` }} /></div>}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function MissingCount({ n }) {
  return <span className={`count ${n ? "some" : "zero"}`}>{n}</span>;
}

function TeamTable({ rows }) {
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div className="scroll">
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            {TEAM_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            <th>Missing</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => [
            <tr key={g} className="group"><td colSpan={TEAM_FIELDS.length + 3}>{g}</td></tr>,
            ...rows.filter((r) => r.group === g).map((r) => (
              <tr key={r.name}>
                <td className="name"><a href={r.profileUrl} target="_blank" rel="noopener noreferrer">{r.name}</a></td>
                <td className="role">{r.role}</td>
                {TEAM_FIELDS.map((f) => (
                  <td key={f.key}>
                    {f.key === "projects" && r.fields.projects.status === "ok" ? (
                      <span className="cell s-ok" data-tip={r.fields.projects.detail} tabIndex={0}>
                        <span className="ico" aria-hidden="true">✓</span>
                        <span className="txt">{r.fields.projects.value.length}</span>
                      </span>
                    ) : (
                      <StatusCell field={r.fields[f.key]} />
                    )}
                  </td>
                ))}
                <td><MissingCount n={r.missingCount} /></td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTable({ rows }) {
  return (
    <div className="scroll">
      <table className="grid">
        <thead>
          <tr>
            <th>Project</th>
            {PROJECT_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
            <th>Missing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="name">{r.name}{r.client && <small>{r.client}</small>}</td>
              {PROJECT_FIELDS.map((f) => (
                <td key={f.key}><StatusCell field={r.fields[f.key]} /></td>
              ))}
              <td><MissingCount n={r.missingCount} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldBars({ summary, fields }) {
  return (
    <div className="bars">
      {fields.map((f) => {
        const { ok, total } = summary.byField[f.key];
        const pct = total ? Math.round((ok / total) * 100) : 0;
        return [
          <span key={f.key + "l"}>{f.label}</span>,
          <span key={f.key + "b"} className="bar" title={`${ok} of ${total} filled`}><span style={{ width: `${pct}%` }} /></span>,
          <span key={f.key + "n"} className="n">{ok}/{total}</span>,
        ];
      })}
    </div>
  );
}

function IssueList({ report }) {
  const fieldLabel = Object.fromEntries([...TEAM_FIELDS, ...PROJECT_FIELDS].map((f) => [f.key, f.label]));
  const issues = [...report.team, ...report.projects]
    .flatMap((r) => Object.entries(r.fields).map(([k, f]) => ({ who: r.name, field: fieldLabel[k], ...f })))
    .filter((f) => f.url && f.status in ISSUE_ORDER)
    .sort((a, b) => ISSUE_ORDER[a.status] - ISSUE_ORDER[b.status]);
  if (!issues.length) return <p className="card-body empty">No link problems found.</p>;
  return (
    <ul className="issues">
      {issues.map((f, i) => (
        <li key={i}>
          <span className={`pill s-${f.status}`}>{STATUS_META[f.status].icon} {STATUS_META[f.status].label}</span>
          <div>
            <div className="what">{f.who} · {f.field}</div>
            <div className="why">{f.detail}</div>
            <a className="url" href={f.url} target="_blank" rel="noopener noreferrer">{f.url}</a>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard() {
  const { report, history, stored } = await getReport();
  const s = report.summary;
  const { repo, branch, sha, site } = report.source;
  const checked = new Date(report.checkedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <h1>Valyria Studios — Site Completeness</h1>
          <span className="meta">
            Checked {checked} PT · <a href={site} target="_blank" rel="noopener noreferrer">{site.replace(/^https?:\/\//, "")}</a>
            {" · "}
            <a href={`https://github.com/${repo}/tree/${branch}`} target="_blank" rel="noopener noreferrer">{repo}@{sha || branch}</a>
          </span>
          <span className="spacer" />
          <RunCheckButton />
        </div>
      </header>

      <main className="wrap">
        <section className="tiles">
          <Tile label="Team profiles complete" value={`${s.teamPct}%`} pct={s.teamPct} sub={`${s.team.filled} of ${s.team.total} items`} />
          <Tile label="Projects complete" value={`${s.projectPct}%`} pct={s.projectPct} sub={`${s.projects.filled} of ${s.projects.total} items`} />
          <Tile label="Broken links" value={s.brokenLinks} sub="Dead pages, 404s, bad domains" />
          <Tile label="Links to double-check" value={s.warnLinks + s.unverifiedLinks} sub={`${s.warnLinks} look wrong · ${s.unverifiedLinks} block bots`} />
          <Tile label="Missing items" value={s.missingItems} sub="Empty fields across the site" />
        </section>

        <Legend />

        <section className="card">
          <div className="card-head">
            <h2>Team profiles</h2>
            <span className="hint">Hover a cell for details · click to open the link · names open the profile page</span>
          </div>
          <TeamTable rows={report.team} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Projects</h2>
            <span className="hint">From the Work page — live site, Loom video, repo, and client link are all tested</span>
          </div>
          <ProjectTable rows={report.projects} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Link problems</h2>
            <span className="hint">Fix these first — broken, then suspicious, then manual checks</span>
          </div>
          <IssueList report={report} />
        </section>

        <div className="two-col">
          <section className="card">
            <div className="card-head"><h2>Most-neglected fields</h2><span className="hint">How many entries have each field</span></div>
            <div className="card-body">
              <h3 style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 10px" }}>Team</h3>
              <FieldBars summary={s.team} fields={TEAM_FIELDS} />
              <h3 style={{ fontSize: 13, color: "var(--ink-2)", margin: "20px 0 10px" }}>Projects</h3>
              <FieldBars summary={s.projects} fields={PROJECT_FIELDS} />
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2>Progress over time</h2><span className="hint">Completeness after each check</span></div>
            <div className="card-body">
              {stored ? (
                <HistoryChart runs={history} />
              ) : (
                <p className="empty">Connect a Neon database (<code>DATABASE_URL</code>) to keep a history of every check.</p>
              )}
            </div>
          </section>
        </div>

        <p className="foot">
          Data is read from <code>src/app/data/team.json</code> and <code>projects.json</code> in the website repo, so editing those
          files is how you fix a gap. A resume link shows up once a <code>resume_url</code> is added to a person&apos;s <code>links</code>.
        </p>
      </main>
    </>
  );
}
