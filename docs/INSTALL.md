# Self-hosting Intygy: run your own API and GitHub App

Only want to scan a repository with the hosted Intygy? Follow [QUICKSTART.md](./QUICKSTART.md)
instead. This guide is for operating the whole stack yourself.

Time: ~45 minutes. You'll need: a GitHub account, a Postgres database, and somewhere to run
a small Node server (Railway, Fly.io, Render, a Hetzner box — or locally with a webhook proxy
for testing).

## Step 1 — Database (5 min)

Create a Postgres instance — a Neon project (choose an EU region near the API host) free
tier is fine. Run `db/schema.sql` against it (Neon: SQL Editor → paste → run, or `psql`
with the **direct** connection string). Copy the **pooled** connection string (host contains
`-pooler`, ends with `?sslmode=require`) for the API; keep the direct one for schema changes
and dump/restore.

Neon suspends idle compute by default. The first request after inactivity waits for it to
wake, typically a few hundred milliseconds to a few seconds; disable scale-to-zero in the Neon project
if that matters. Free Render web services also sleep when idle, which adds a much longer
cold start to the first webhook or scan.

## Step 2 — Deploy the API (10 min)

Deploy `packages/api` to any Node host. Railway/Render: point at the repo,
start command `pnpm --filter @intygy/api start`, root install command `pnpm install`.
The start command uses `tsx`, so do not omit development dependencies from this MVP deployment.

For local testing, copy `packages/api/.env.example` to `packages/api/.env`. For a hosted
deployment, use the host’s secret settings. Configure the following before starting the API.

Set these environment variables (see `packages/api/.env.example`):

- `DATABASE_URL` — from Step 1
- `PUBLIC_BASE_URL` — your deployed API URL (or `http://localhost:3000`). It must equal the
  `api-base` customers pass to the Action, without a trailing slash: workflow tokens are issued for it.
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_B64`, `GITHUB_WEBHOOK_SECRET` — from Step 3
- `LINK_SIGNING_SECRET` — generate with `openssl rand -hex 32`. Signs dashboard and report
  links; the API will not start without it, and changing it invalidates every issued link.

## Step 3 — Register the GitHub App (10 min)

GitHub → Settings → **Developer settings** → **GitHub Apps** → **New GitHub App**:

| Field | Value |
| --- | --- |
| Name | `intygy-dev-yourname` (must be globally unique) |
| Homepage URL | your API URL (anything works) |
| Webhook URL | `https://YOUR_API/api/github/webhook` (or the smee.io channel URL) |
| Webhook secret | invent one; same value as `GITHUB_WEBHOOK_SECRET` |
| Permissions | **Pull requests: Read & write** and **Issues: Read & write** (PR comments), **Contents: Read-only** (verify branch head), **Metadata: Read-only** |
| Subscribe to events | *(none needed beyond the default installation events)* |
| Where can it be installed | Only on this account (fine for now) |

After creating: note the **App ID**, then **Generate a private key** (downloads a `.pem`).
Convert it for the env var: `base64 -w0 your-key.pem` → `GITHUB_APP_PRIVATE_KEY_B64`.
With all variables set, start the API. Locally, run `pnpm dev:api` and forward GitHub
webhooks with `npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:3000/api/github/webhook`.
GitHub-hosted runners also need a reachable API URL for ingest. A webhook proxy alone only forwards events.

Check that the process is serving requests:

```bash
curl -i http://localhost:3000/healthz
```

`/healthz` checks the API process only. To confirm Postgres is reachable, send an unknown API key;
a connected database returns `401 unknown api key`, while a connection problem returns `500`:

```bash
curl -i -X POST http://localhost:3000/api/ingest \
  -H 'Authorization: Bearer invalid' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Step 4 — Install the App on a target repo (2 min)

Install your GitHub App on the target repository. Its installation webhook provisions
the project. In your database client, replace `owner/repo` with its full name:

```sql
SELECT p.api_key
FROM projects p
JOIN installations i ON i.id = p.installation_id
WHERE p.repo = 'owner/repo' AND p.active AND i.active;
```

Give the key to the administrator of that repository for the `INTYGY_KEY` Actions secret.

## Step 5 — Connect and verify the repository

Follow the [quickstart from step 3](./QUICKSTART.md#3-add-the-key-as-a-secret).
Override the example workflow’s `api-base` with your API’s `PUBLIC_BASE_URL`.
To verify resolution history, fix an existing open baseline finding and confirm a
current default-branch scan covers the same route, viewport, and ruleset.

## Authenticated routes

Create repository Actions secrets `INTYGY_TEST_USER` and `INTYGY_TEST_PASS` for a
dedicated test account. Keep routes, target and readiness settings in the root
`intygy.yml`. The Action reads that file literally. To supply credentials at run time,
insert this step immediately before the Intygy step in the example Ubuntu workflow:

```yaml
- name: Prepare authenticated scan config
  env:
    TEST_USER: ${{ secrets.INTYGY_TEST_USER }}
    TEST_PASS: ${{ secrets.INTYGY_TEST_PASS }}
  run: |
    python3 - <<'PYTHON'
    import json
    import os
    from pathlib import Path

    auth = {
        "login_url": "/login",
        "user": os.environ["TEST_USER"],
        "pass": os.environ["TEST_PASS"],
        "success_selector": "[data-testid=sign-out]",
    }
    path = Path(os.environ["RUNNER_TEMP"]) / "intygy.yml"
    with open(path, "x", opener=lambda name, flags: os.open(name, flags, 0o600)) as config:
        config.write(Path("intygy.yml").read_text() + "\nauth: " + json.dumps(auth) + "\n")
    PYTHON
```

Use a base config without an existing `auth` entry. Adapt the login path and choose
a success selector visible after login and on every scanned route. If your form uses
custom controls, set `user_field`, `pass_field`, and `submit` selectors in `auth`.
Add this input alongside `api-key` and `api-base` in the Intygy step’s `with` block:

```yaml
config-path: ${{ runner.temp }}/intygy.yml
```

## Troubleshooting

- **"No successful preview deployment found"** — the repo has no Vercel/Netlify preview;
  switch `intygy.yml` to the `serve:` target.
- **Invalid scan payload / upgrade error** — deploy the new Action and API together after migration.
- **Missing readiness / authentication selector** — configure application-specific visible markers; do not use a loading shell or login page as proof of readiness.
- **Unexpected redirect** — use the canonical route. A trailing slash is allowed; login redirects and other destinations fail the scan.
- **Inactive installation or repository** — restore App access. Re-adding a removed repo rotates its key; retrieve and replace `INTYGY_KEY`.
- **Stale default-branch scan** — the commit is no longer the branch head. Results remain in history without changing the baseline; scan the current head.
- **No PR comment despite red check** — check API logs; usually the App lacks
  Pull requests write permission or `installation_id` is null (reinstall the App).
- **Missing or invalid workflow token (401)** — the job needs `permissions: id-token: write`,
  and the Action's `api-base` must equal the API's `PUBLIC_BASE_URL`. Pull requests from
  forks cannot obtain a token (or the key) and are not scanned.
- **Scan does not match the workflow token (403)** — the reported repository, branch,
  commit, or pull request differs from the run GitHub attests. Check out the triggering commit.
- **Dashboard or report shows "not found"** — the link is unsigned, older than 30 days, or
  was issued before `LINK_SIGNING_SECRET` changed. Open the link from a recent run summary
  or PR comment; any new scan issues a fresh one.
- **Webhook 401** — `GITHUB_WEBHOOK_SECRET` mismatch between App settings and env.
- **Playwright install slow in CI** — first run downloads Chromium (~1 min);
  add `actions/cache` on `~/.cache/ms-playwright` keyed to the playwright version.
- **Push workflow fails but PR scans work** — `target: preview` needs a deployment for the
  `main` commit. Use `serve:` or a fixed `url:` if your host doesn't deploy on push.
- **Evidence shows no resolved issues after merge** — confirm the workflow includes
  `push: branches: [main]` and that a push scan completed successfully.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for component diagram, auth model, and local curl testing.

## Upgrade an existing database and Action

1. Back up the database and stop the API to avoid writes during fingerprint migration.
2. Apply `db/migrations/001-flow-integrity.sql` against that database. It is transactional
   and safe to rerun. Fresh databases continue to use `db/schema.sql` instead.
3. Deploy the new API, grant the App Contents read permission, and publish the rebuilt
   Action under a new release. Update customer workflows to that release together with
   `readySelector` (and `auth.success_selector` when using login). Do not mix old Actions
   with the version 2 API: they fail explicitly instead of changing baseline state.
4. Retrieve rotated keys for repositories that were removed and re-added. Keys for
   continuously active installations are preserved.
5. Run a current default-branch scan and inspect the linked report and evidence coverage.

The migration maps each old fingerprint to its latest recorded first selector and keeps
its first-seen and last-resolution dates. The original fingerprint is retained in
`legacy_fingerprint`; old violation rows are unchanged. Additional nodes that the old
scanner discarded cannot be grandfathered safely and may now block PRs. Structured
iframe/shadow selectors and changed exact selectors can also appear as new findings.
Unmappable legacy baseline rows remain unchanged and are shown outside verified coverage.
Do not delete those rows or silently accept current findings just to get a green check.

Older resolution/reopening cycles were overwritten by the old schema and cannot be
reconstructed. Evidence labels the imported snapshot; all future cycles are retained.
Restoring the database backup and previous API/Action is the rollback path; do not run
old ingestion code against migrated fingerprints. No deployment or migration is run by
the repository's test/build commands.

For SQL tests against a disposable Postgres instance, set `INTYGY_TEST_DATABASE_URL` and
run `pnpm test`. See `ARCHITECTURE.md` for embedded versus multi-connection test scope.

## Maintainers: release the Action

Customer repos use the Action as `Inn-Keeper/intygy@v1`. After changing `packages/action/src`:

```bash
pnpm build:action
git add packages/action/dist && git commit -m "Build action" && git push
```

CI fails if the committed `dist/` is stale. Then publish a GitHub Release tagged `vX.Y.Z`;
the release workflow moves the `vX` tag to it. Tick **Publish this Action to the GitHub
Marketplace** on the release form to list it.
