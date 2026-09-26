# Intygy — Architecture

## Overview

Intygy splits work between **customer CI** (heavy scanning) and **operator-hosted API** (baseline logic, evidence, PR comments).

```mermaid
flowchart LR
  subgraph customer["Customer GitHub repo"]
    WF["workflow: PR + push to main"]
    ACT["Intygy Action"]
    PW["Playwright + axe-core"]
    WF --> ACT --> PW
  end

  subgraph operator["Intygy operator"]
    API["Hono API"]
    DB[(Postgres)]
    APP["GitHub App"]
    API --> DB
    API --> APP
  end

  PW -->|"POST /api/ingest"| API
  APP -->|"PR comment"| customer
  APP -->|"install webhook"| API
  ACT -->|"GITHUB_TOKEN: preview URLs"| customer
```

## Components

| Component | Location | Responsibility |
| --- | --- | --- |
| **Action** | `packages/action` | Resolve app URL, run scans, POST results, fail job if blocked |
| **API** | `packages/api` | Ingest, fingerprint, baseline diff, dashboard, evidence, webhooks |
| **Shared types** | `packages/shared/types.ts` | `ScanPayload` / `IngestResponse` contract (imported by action + api) |
| **Schema** | `db/schema.sql` | Projects, scans, violations, baselines, attestations |
| **Examples** | `examples/` | Workflow + `intygy.yml` templates for customer repos |

`packages/shared` is a types-only folder (no `package.json`). Both packages import it via relative paths and include it in their `tsconfig.json`.

## Authentication (two mechanisms)

| Credential | Who provides it | Used for |
| --- | --- | --- |
| `INTYGY_KEY` (API key) | Intygy operator → customer repo secret | Action authenticates to `POST /api/ingest` |
| `GITHUB_TOKEN` | GitHub Actions (customer repo) | Action reads Deployments API to find preview URLs |
| **GitHub App** (operator) | Intygy operator env vars | API posts PR comments; webhook provisions projects on install |

Customers never configure the GitHub App directly — they install it once; the operator runs it.

## Scan lifecycle

### 1. First scan (any trigger)

- API has no baseline → `isFirstScan = true`
- All violations absorbed into `baselines` table
- `blocked: false` — check passes, legacy debt is recorded not punished

### 2. Pull request scan

- Action sends `prNumber` in payload
- API fingerprints each violation (`rule|route|viewport|selector`, nth-child normalized)
- Violations not in open baseline → **new** → `blocked: true`, GitHub App comments on PR
- Action fails the CI job

### 3. Push to default branch (e.g. `main`)

- Workflow must include `push: branches: [main]` — see `examples/intygy-workflow.yml`
- Action sends no `prNumber`; `branch` = default branch name
- API absorbs current violations into baseline
- Violations in baseline but absent from scan → `resolved_at` set (evidence burn-down)

```text
PR opened     → scan → diff vs baseline → block if new
PR merged     → (no scan yet)
Push to main  → scan → update baseline → mark resolved issues
Evidence page → shows resolution history from baselines.resolved_at
```

## API routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/ingest` | Bearer API key | Receive scan results from Action |
| `POST /api/github/webhook` | HMAC signature | GitHub App install → create project + API key |
| `GET /p/:id` | None (UUID obscurity) | Project dashboard |
| `GET /p/:id/evidence` | None (UUID obscurity) | EN 301 549 evidence dossier |
| `GET /healthz` | None | Health check |

## Deployment topology

**Operator** (you):

1. Deploy `packages/api` (Railway, Fly, Render, etc.)
2. Run `db/schema.sql` against Postgres
3. Register GitHub App pointing webhook at `/api/github/webhook`
4. Build and commit `packages/action/dist`, then publish a GitHub Release `vX.Y.Z` (moves the `vX` tag; tick "Publish to Marketplace")

**Customer** (per protected repo):

1. Install your GitHub App on their repo
2. Add `INTYGY_KEY` secret
3. Copy `intygy-workflow.yml` + `intygy.yml`
4. CI runs on every PR and every push to `main`

One API instance serves many customer repos (multi-tenant via `projects` table).

## Target resolution (`intygy.yml`)

| `target` | When to use | Notes |
| --- | --- | --- |
| `preview` | Vercel/Netlify with PR previews | Needs `GITHUB_TOKEN`; polls Deployments API |
| `{ url }` | Fixed staging/production URL | Simple; same URL for PR and push |
| `{ serve, url }` | Static sites or local serve in CI | Builds and serves inside the runner |

For `push` to `main` with `target: preview`, the host must deploy that commit (production or preview) before the workflow runs. If push scans fail to find a deployment, switch to `serve:` or a fixed `url:` for the main-branch job.

## Testing

### 1. Unit tests (no infra)

```bash
pnpm install
pnpm test
pnpm typecheck
```

Covers fingerprint stability, payload validation, and comment label parsing.

### 2. Build the Action bundle

```bash
pnpm build:action
ls packages/action/dist/index.js   # must be committed: `uses: Inn-Keeper/intygy@v1` runs it
```

### 3. Local API + simulated scans

Start Postgres (or Supabase), apply schema, run API:

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/intygy
export GITHUB_APP_ID=1
export GITHUB_APP_PRIVATE_KEY_B64=$(base64 < test-key.pem | tr -d '\n')
export GITHUB_WEBHOOK_SECRET=test-secret
export PUBLIC_BASE_URL=http://localhost:3000
pnpm dev:api
```

Seed a project (or trigger webhook via smee.io). Then simulate the three scan phases:

**A — First scan (establish baseline):**

```bash
API_KEY=igy_your_key_here

curl -s -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "acme/shop",
    "sha": "abc111",
    "branch": "main",
    "ruleset": "wcag22-aa",
    "routesScanned": ["/"],
    "startedAt": "2026-07-09T10:00:00.000Z",
    "finishedAt": "2026-07-09T10:01:00.000Z",
    "violations": [{
      "ruleId": "color-contrast",
      "wcag": ["wcag2aa", "wcag143"],
      "impact": "serious",
      "description": "Low contrast",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
      "route": "/",
      "viewport": "desktop",
      "nodes": [{ "selector": ".btn" }]
    }]
  }' | jq
# Expect: blocked=false, baselineOpenCount=1
```

**B — PR scan introducing a new violation:**

```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "acme/shop",
    "sha": "def222",
    "branch": "feature",
    "prNumber": 42,
    "ruleset": "wcag22-aa",
    "routesScanned": ["/"],
    "startedAt": "2026-07-09T11:00:00.000Z",
    "finishedAt": "2026-07-09T11:01:00.000Z",
    "violations": [
      {
        "ruleId": "color-contrast",
        "wcag": ["wcag2aa", "wcag143"],
        "impact": "serious",
        "description": "Low contrast",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
        "route": "/",
        "viewport": "desktop",
        "nodes": [{ "selector": ".btn" }]
      },
      {
        "ruleId": "button-name",
        "wcag": ["wcag2a", "wcag412"],
        "impact": "critical",
        "description": "Missing name",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.10/button-name",
        "route": "/",
        "viewport": "desktop",
        "nodes": [{ "selector": ".icon-btn" }]
      }
    ]
  }' | jq
# Expect: blocked=true, newCount=1
```

**C — Push to main with fix (mark resolved):**

```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "acme/shop",
    "sha": "ghi333",
    "branch": "main",
    "ruleset": "wcag22-aa",
    "routesScanned": ["/"],
    "startedAt": "2026-07-09T12:00:00.000Z",
    "finishedAt": "2026-07-09T12:01:00.000Z",
    "violations": []
  }' | jq
# Expect: blocked=false; baselines.resolved_at set for prior open issues
```

Verify in Postgres:

```sql
select fingerprint, first_seen, resolved_at from baselines order by first_seen;
select count(*) from baselines where resolved_at is not null;  -- should be > 0 after step C
```

Open `http://localhost:3000/p/<project-id>/evidence` — resolved count should reflect step C.

### 4. End-to-end on GitHub

Follow [INSTALL.md](./INSTALL.md). After wiring a target repo:

1. **PR #1** → green, baseline established (job summary shows open issue count)
2. **PR #2** with intentional a11y regression → red, Intygy bot comments
3. Fix and push → green
4. **Merge to main** → push workflow runs → check evidence page for updated `resolved` count

Confirm both workflow triggers fired: Actions tab should show runs for `pull_request` and `push` events.
