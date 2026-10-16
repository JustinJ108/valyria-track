# Valyria Site Tracker

A dashboard showing how complete and up to date
[valyria-website.vercel.app](https://valyria-website.vercel.app) is.

It reads `src/app/data/team.json` and `src/app/data/projects.json` straight from
the [website repo](https://github.com/lbarberiscanoni/valyria-website), so it stays current
on its own. Every link gets tested:

- **Team:** photo, bio, skills, LinkedIn, GitHub, portfolio, resume, credited projects
- **Projects:** developer, description, thumbnail, live site, Loom video, repo, client link, dates

| Status | Meaning |
|---|---|
| ✓ OK | Present and the link works |
| ✗ Missing | Field is empty on the site |
| ✗ Broken | 404, dead domain, timeout, Loom video gone, TestFlight closed |
| ⚠ Check | Works, but looks wrong (e.g. "GitHub" points to a non-GitHub site, or redirects to a different domain) |
| ? Verify | The site blocks automated checks (LinkedIn, Cloudflare). Open it by hand |

## How it stays up to date

The page is cached by Vercel, so it always loads instantly:

- Once the results are **over an hour old**, opening the page shows the old results right away,
  re-checks in the background, and swaps the new results in when they're ready (about 15 seconds, no reload).
- **Run check now** does the same on demand.
- A **daily cron** (`vercel.json`, 13:00 UTC) refreshes it even if nobody visits.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000 (always checks live; no caching in dev)
npm run check        # print the report in the terminal
```

To try the caching behaviour locally, use `npm run build && npm start`.

## Deploy to Vercel

1. Import this repo at vercel.com/new and click **Deploy** with the default settings.
2. Optional: add a `CRON_SECRET` env var (any random string) so only Vercel's cron can call `GET /api/check`.

That's all. No database is needed.

## Optional: Neon for history

Connecting Neon adds a "Progress over time" chart and keeps a record of every check.

1. In the Vercel project: **Storage → Create Database → Neon**, connect it to all environments.
   This sets `DATABASE_URL`.
2. Create the tables once: `DATABASE_URL="postgres://..." npm run db:init`
3. Redeploy.

## Data model (Neon)

- `check_runs`: one row per check, with summary numbers and the full report as JSON
- `check_results`: one row per field per person/project (status, URL, HTTP code, detail)

Example: every link that's currently broken

```sql
SELECT entity_name, field, url, detail FROM check_results
WHERE run_id = (SELECT max(id) FROM check_runs) AND status = 'broken';
```

## Adding resume links

Add `"resume_url": "https://..."` to a person's `links` in `team.json` on the website.
The Resume column turns green on the next check. (The website itself also needs to
render it on the profile page.)
