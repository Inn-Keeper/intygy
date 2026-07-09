# Installing Intygy on your own GitHub (today, end to end)

Time: ~45 minutes. You'll need: a GitHub account, a Postgres database, and somewhere to run
a small Node server (Railway, Fly.io, Render, a Hetzner box — or locally with a webhook proxy
for testing).

## Step 0 — Push this code

Create a repo (e.g. `dalton/intygy`), push this codebase, then build and commit the Action bundle:

```bash
pnpm install
pnpm build:action
git add packages/action/dist -f && git commit -m "build action" && git push
```

(The `dist/` bundle must be committed for `uses: dalton/intygy/packages/action@main` to work.)

## Step 1 — Database (5 min)

Create a Postgres instance — Supabase (choose an EU region) free tier is fine.
Run `db/schema.sql` against it (Supabase: SQL Editor → paste → run).
Copy the connection string.

## Step 2 — Deploy the API (10 min)

Deploy `packages/api` to any Node host. Railway/Render: point at the repo,
start command `pnpm --filter @intygy/api start`, root install command `pnpm install`.

**For local testing instead:** run `DATABASE_URL=... pnpm dev:api` and start a webhook
proxy with [smee.io](https://smee.io) — create a channel, then
`npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:3000/api/github/webhook`.

Set these environment variables (see `packages/api/.env.example`):

- `DATABASE_URL` — from Step 1
- `PUBLIC_BASE_URL` — your deployed API URL (or `http://localhost:3000`)
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_B64`, `GITHUB_WEBHOOK_SECRET` — from Step 3

## Step 3 — Register the GitHub App (10 min)

GitHub → Settings → **Developer settings** → **GitHub Apps** → **New GitHub App**:

| Field | Value |
| --- | --- |
| Name | `intygy-dev-yourname` (must be globally unique) |
| Homepage URL | your API URL (anything works) |
| Webhook URL | `https://YOUR_API/api/github/webhook` (or the smee.io channel URL) |
| Webhook secret | invent one; same value as `GITHUB_WEBHOOK_SECRET` |
| Permissions | **Issues: Read & write** (PR comments), **Pull requests: Read-only**, **Metadata: Read-only** |
| Subscribe to events | *(none needed beyond the default installation events)* |
| Where can it be installed | Only on this account (fine for now) |

After creating: note the **App ID**, then **Generate a private key** (downloads a `.pem`).
Convert it for the env var: `base64 -w0 your-key.pem` → `GITHUB_APP_PRIVATE_KEY_B64`.
Restart/redeploy the API with all env vars set.

## Step 4 — Install the App on a target repo (2 min)

On the App's page click **Install App**, pick the repository you want to protect
(your React flashcard app is a perfect guinea pig). The installation webhook fires and the
API creates a project row. Get its API key:

```sql
select repo, api_key, id from projects;
```

(Supabase SQL editor. Yes, manual for now — the onboarding UI is the first post-MVP task.)

## Step 5 — Wire up the target repo (5 min)

In the repo you're protecting:

1. Settings → Secrets → Actions → new secret `INTYGY_KEY` = the api_key from Step 4.
2. Copy `examples/intygy-workflow.yml` → `.github/workflows/intygy.yml`, replacing
   `YOUR_GITHUB_USER/intygy` and `YOUR_DEPLOYED_API_URL`. The workflow runs on **pull requests**
   (gate new violations) and **pushes to `main`** (update baseline, mark resolved issues).
3. Copy `examples/intygy.yml` → repo root; set real routes. No Vercel/Netlify previews?
   Use the `serve:` variant.

## Step 6 — See it work (5 min)

1. Open any PR → the check runs → **baseline established**, check is green,
   dashboard link in the job summary shows your existing issue count.
2. Now break something on purpose in a new PR — e.g. add `style={{outline:'none'}}`
   to a focusable button, or set a text color to low contrast.
3. The check goes **red**, and the Intygy bot comments on the PR with the rule,
   the WCAG criterion, the selector, and a fix link.
4. Fix it, push, check goes green. Merge to `main` → the **push** workflow runs and records
   any resolved issues. Visit `/p/<project-id>/evidence` — the dossier should show updated
   resolution counts.

## Troubleshooting

- **"No successful preview deployment found"** — the repo has no Vercel/Netlify preview;
  switch `intygy.yml` to the `serve:` target.
- **No PR comment despite red check** — check API logs; usually the App lacks
  Issues write permission or `installation_id` is null (reinstall the App).
- **Webhook 401** — `GITHUB_WEBHOOK_SECRET` mismatch between App settings and env.
- **Playwright install slow in CI** — first run downloads Chromium (~1 min);
  add `actions/cache` on `~/.cache/ms-playwright` keyed to the playwright version.
- **Push workflow fails but PR scans work** — `target: preview` needs a deployment for the
  `main` commit. Use `serve:` or a fixed `url:` if your host doesn't deploy on push.
- **Evidence shows no resolved issues after merge** — confirm the workflow includes
  `push: branches: [main]` and that a push scan completed successfully.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for component diagram, auth model, and local curl testing.
