// Pulls team.json / projects.json from the website repo, checks every field and
// link, and returns a report the dashboard renders (and the DB stores).

export const SOURCE_REPO = process.env.SOURCE_REPO || "lbarberiscanoni/valyria-website";
export const SOURCE_BRANCH = process.env.SOURCE_BRANCH || "main";
export const SITE_URL = (process.env.SITE_URL || "https://valyria-website.vercel.app").replace(/\/$/, "");

const RAW = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}`;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// Status values, worst first. "missing" and "broken" count against completeness.
export const STATUS = {
  ok: "ok",
  warn: "warn", // present but something is off (redirects elsewhere, wrong kind of link)
  unverified: "unverified", // site blocks automated checks; open it by hand
  broken: "broken",
  missing: "missing",
};

export const TEAM_FIELDS = [
  { key: "photo", label: "Photo" },
  { key: "bio", label: "Bio" },
  { key: "skills", label: "Skills" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "github", label: "GitHub" },
  { key: "portfolio", label: "Portfolio" },
  { key: "resume", label: "Resume" },
  { key: "projects", label: "Projects" },
];

export const PROJECT_FIELDS = [
  { key: "developer", label: "Developer" },
  { key: "description", label: "Description" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "live", label: "Live project" },
  { key: "video", label: "Video" },
  { key: "repo", label: "Repo" },
  { key: "client", label: "Client link" },
  { key: "dates", label: "Dates" },
];

const clean = (v) => (typeof v === "string" ? v.trim() : v);
const slugify = (name) => name.toLowerCase().trim().replace(/\s+/g, "-");
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function getJson(path) {
  const res = await fetch(`${RAW}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${path} from ${SOURCE_REPO} (${res.status})`);
  return res.json();
}

async function getSourceSha() {
  try {
    const res = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/commits/${SOURCE_BRANCH}`, {
      headers: { accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()).sha?.slice(0, 7) ?? null;
  } catch {
    return null;
  }
}

// Only a few requests at a time — firing them all at once causes spurious
// connection timeouts and rate limiting.
const MAX_CONCURRENT = 6;
let active = 0;
const queue = [];
async function limited(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Network errors and 429/5xx are often temporary, so try once more before
// calling a link broken. DNS failures are permanent and not retried.
async function fetchWithRetry(url) {
  const attempt = () =>
    limited(async () => {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": UA, accept: "text/html,*/*" },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      return { res, body: (await res.text()).slice(0, 300000) };
    });
  const retryable = hostOf(url) !== "linkedin.com";
  try {
    const out = await attempt();
    if (retryable && (out.res.status === 429 || out.res.status >= 500)) {
      await sleep(1500);
      return await attempt();
    }
    return out;
  } catch (e) {
    if (!retryable || e.cause?.code === "ENOTFOUND") throw e;
    await sleep(1500);
    return attempt();
  }
}

// Fetches a URL like a browser would and classifies the result.
export async function checkUrl(url) {
  const host = hostOf(url);
  if (!host) return { status: STATUS.broken, detail: "Not a valid URL" };

  let res, body = "";
  try {
    ({ res, body } = await fetchWithRetry(url));
  } catch (e) {
    const code = e.cause?.code || e.name;
    if (code === "ENOTFOUND") return { status: STATUS.broken, detail: "Domain does not exist (DNS lookup failed)" };
    if (code === "TimeoutError") return { status: STATUS.broken, detail: "No response after 15s (tried twice)" };
    return { status: STATUS.broken, detail: `Could not connect (${code}, tried twice)` };
  }

  const code = res.status;
  const finalUrl = res.url;
  const finalHost = hostOf(finalUrl);
  const title = (body.match(/<title[^>]*>([^<]*)/i)?.[1] || "").trim();
  const ogTitle = body.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
  const base = { httpCode: code, finalUrl: finalUrl !== url ? finalUrl : null, title };

  // Sites that block bots: we can't tell, so ask a human.
  if (host.endsWith("linkedin.com")) {
    if (code === 999 || code === 429 || /reCAPTCHA|authwall|security verification/i.test(title))
      return { ...base, status: STATUS.unverified, detail: "LinkedIn blocks automated checks — open it to confirm" };
    if (code === 404) return { ...base, status: STATUS.broken, detail: "Profile not found (404)" };
    if (code === 200 && /LinkedIn/i.test(title)) return { ...base, status: STATUS.ok, detail: title };
  }
  if ((code === 403 || code === 429 || code === 503) && /cloudflare|attention required|just a moment/i.test(title + body.slice(0, 5000)))
    return { ...base, status: STATUS.unverified, detail: "Site blocks automated checks (Cloudflare) — open it to confirm" };

  if (code >= 400) {
    const note = code === 404 ? " (not found)" : code === 403 ? " (forbidden — may also be blocking bots)" : "";
    return { ...base, status: STATUS.broken, detail: `Page returns HTTP ${code}${note}` };
  }

  // Pages that return 200 even when the content is gone.
  if (host === "loom.com" && /not found|no longer available|has been deleted/i.test(title))
    return { ...base, status: STATUS.broken, detail: "Loom video unavailable" };
  if (host === "testflight.apple.com" && /beta is full|isn.t accepting any new testers|no longer available/i.test(body))
    return { ...base, status: STATUS.broken, detail: "TestFlight beta is full or closed" };
  if (host === "figma.com" && ogTitle === "Figma")
    return { ...base, status: STATUS.unverified, detail: "Figma file may be private — open it logged-out to confirm" };

  // Sends visitors to an entirely different site (ignores www / same-host moves).
  if (finalHost && finalHost !== host)
    return { ...base, status: STATUS.warn, detail: `Redirects to ${finalHost}` };

  return { ...base, status: STATUS.ok, detail: title || `HTTP ${code}` };
}

// Every URL is fetched once even if it appears in several places.
function makeUrlChecker() {
  const cache = new Map();
  return (url) => {
    if (!cache.has(url)) cache.set(url, checkUrl(url));
    return cache.get(url);
  };
}

async function linkField(check, url, { expectHost, expectLabel } = {}) {
  url = clean(url);
  if (!url) return { status: STATUS.missing, detail: "Not provided" };
  const result = { url, ...(await check(url)) };
  if (expectHost && hostOf(url) !== expectHost && result.status !== STATUS.broken)
    return { ...result, status: STATUS.warn, detail: `Not a ${expectLabel} link (${hostOf(url)}). ${result.detail || ""}`.trim() };
  return result;
}

async function imageField(check, path) {
  path = clean(path);
  if (!path) return { status: STATUS.missing, detail: "No image set" };
  const url = `${SITE_URL}/${path.replace(/^\//, "")}`;
  const r = await check(url);
  return r.status === STATUS.ok ? { url, status: STATUS.ok, detail: path } : { url, ...r, detail: `Image ${path}: ${r.detail}` };
}

// Resolves an object whose values may be promises.
async function resolveAll(obj) {
  const entries = await Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await v]));
  return Object.fromEntries(entries);
}

const textField = (value, what) =>
  clean(value) ? { status: STATUS.ok, detail: clean(value) } : { status: STATUS.missing, detail: `No ${what}` };

export function summarize(rows, fields) {
  let filled = 0, total = 0;
  const byField = Object.fromEntries(fields.map((f) => [f.key, { ok: 0, total: 0 }]));
  for (const row of rows) {
    row.missingCount = 0;
    for (const f of fields) {
      const s = row.fields[f.key].status;
      const good = s !== STATUS.missing && s !== STATUS.broken;
      total++;
      byField[f.key].total++;
      if (good) {
        filled++;
        byField[f.key].ok++;
      } else row.missingCount++;
    }
  }
  return { filled, total, pct: total ? Math.round((filled / total) * 100) : 0, byField };
}

export async function runCheck() {
  const [team, projectData, sourceSha] = await Promise.all([
    getJson("src/app/data/team.json"),
    getJson("src/app/data/projects.json"),
    getSourceSha(),
  ]);
  const projects = projectData.projects;
  const check = makeUrlChecker();

  const members = [
    ...team.leadership.map((m) => ({ ...m, group: "Leadership" })),
    ...team.students.map((m) => ({ ...m, group: "Developers" })),
  ];

  const teamRows = await Promise.all(
    members.map(async (m) => {
      const links = m.links || {};
      const name = clean(m.name);
      const theirProjects = projects
        .filter((p) => [p.developer, p.designer].some((who) => clean(who) && clean(who).includes(name)))
        .map((p) => p.name);
      return {
        name,
        role: m.role,
        group: m.group,
        profileUrl: `${SITE_URL}/${slugify(name)}`,
        fields: await resolveAll({
          photo: imageField(check, m.image),
          bio: textField(m.bio, "bio"),
          skills: m.skills?.length
            ? { status: STATUS.ok, detail: m.skills.join(", ") }
            : { status: STATUS.missing, detail: "No skills listed" },
          linkedin: linkField(check, links.linkedin, { expectHost: "linkedin.com", expectLabel: "LinkedIn" }),
          github: linkField(check, links.github, { expectHost: "github.com", expectLabel: "GitHub" }),
          portfolio: linkField(check, links.portfolio_url || links.portfolio),
          resume: linkField(check, links.resume_url || links.resume),
          projects: theirProjects.length
            ? { status: STATUS.ok, detail: theirProjects.join(", "), value: theirProjects }
            : { status: STATUS.missing, detail: "Not credited on any project", value: [] },
        }),
      };
    })
  );

  const memberNames = new Set(members.map((m) => clean(m.name)));
  const projectRows = await Promise.all(
    projects.map(async (p) => {
      const dev = clean(p.developer);
      const hasDates = clean(p.start_date);
      return {
        name: clean(p.name),
        client: clean(p.client) || "",
        fields: await resolveAll({
          developer: !dev
            ? { status: STATUS.missing, detail: "No developer credited" }
            : memberNames.has(dev)
              ? { status: STATUS.ok, detail: dev }
              : { status: STATUS.warn, detail: `${dev} is not on the team page` },
          description: textField(p.description, "description"),
          thumbnail: imageField(check, p.thumbnail),
          live: linkField(check, p["project-url"]),
          video: linkField(check, p["video-url"]),
          repo: linkField(check, p["repo-link"], { expectHost: "github.com", expectLabel: "GitHub" }),
          client: linkField(check, p["client-url"]),
          dates: hasDates
            ? { status: STATUS.ok, detail: `${p.start_date} → ${clean(p.end_date) || "present"}` }
            : { status: STATUS.missing, detail: "No start date" },
        }),
      };
    })
  );

  const teamSummary = summarize(teamRows, TEAM_FIELDS);
  const projectSummary = summarize(projectRows, PROJECT_FIELDS);

  const all = [...teamRows, ...projectRows].flatMap((r) => Object.values(r.fields));
  const linkCount = (s) => all.filter((f) => f.url && f.status === s).length;

  return {
    checkedAt: new Date().toISOString(),
    source: { repo: SOURCE_REPO, branch: SOURCE_BRANCH, sha: sourceSha, site: SITE_URL },
    team: teamRows,
    projects: projectRows,
    summary: {
      teamPct: teamSummary.pct,
      projectPct: projectSummary.pct,
      team: teamSummary,
      projects: projectSummary,
      brokenLinks: linkCount(STATUS.broken),
      warnLinks: linkCount(STATUS.warn),
      unverifiedLinks: linkCount(STATUS.unverified),
      missingItems: all.filter((f) => f.status === STATUS.missing).length,
    },
  };
}
