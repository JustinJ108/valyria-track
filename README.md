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

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # print the report in the terminal
```

Without `DATABASE_URL` the dashboard runs a live check (cached for 5 minutes) and skips history.

## Deploy to Vercel + Neon

1. Push this folder to a GitHub repo and import it in Vercel.
2. In the Vercel project: **Storage → Create → Neon**. This sets `DATABASE_URL`.
3. Add a `CRON_SECRET` env var (any random string).
4. Create the tables once, using the connection string from Neon:
   ```bash
   DATABASE_URL="postgres://..." npm run db:init
   ```
5. Deploy. `vercel.json` runs a check every day at 13:00 UTC. Each run is saved,
   which fills the "Progress over time" chart. The **Run check now** button runs one on demand.

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
