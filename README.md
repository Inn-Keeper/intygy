# Intygy — MVP

Accessibility compliance, reviewed in every pull request. Blocks new WCAG 2.2 violations
at the PR and compiles an EN 301 549 evidence dossier from your merge history.

## Repo layout

```text
packages/action   TypeScript GitHub Action: Playwright + axe-core scanner → posts to the API
packages/api      Hono (Node) API: ingest, baseline diffing, PR comments, dashboard, evidence
packages/shared   Payload types shared by both
db/schema.sql     Postgres schema
examples/         Workflow + intygy.yml templates for customer repos
docs/INSTALL.md   Step-by-step: run this on YOUR GitHub today
```

## How it fits together

1. Customer repo runs the **Action** on every PR (their CI minutes). It resolves a rendered
   app (preview URL or `serve` command), scans configured routes with axe-core, and POSTs
   results to the API with the project's key.
2. The **API** fingerprints each violation (`rule|route|viewport|selector`), diffs against the
   project **baseline**, comments on the PR via the GitHub App when new violations appear,
   and returns `blocked: true` so the Action fails the check.
3. First scan = baseline (nothing blocks). Pushes to the default branch update the baseline
   and mark disappeared issues as resolved — that dated history feeds the **evidence dossier**
   (`/p/:id/evidence`).

## Commands

```bash
pnpm install                # workspace deps (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 locally)
pnpm typecheck              # both packages
pnpm build:action           # bundles packages/action/dist (commit dist to use via uses:)
pnpm dev:api                # local API on :3000 (needs DATABASE_URL)
```

## Honest MVP boundaries (do before charging money)

- **Dashboard/evidence routes are unauthenticated** (obscure UUID only) — add auth.
- API key retrieval is manual (`select api_key from projects`) — build the onboarding page.
- `CRITERIA` in `evidence.ts` is a 15-item subset — extend to the full WCAG 2.2 AA list.
- No Stripe yet; no screenshots in PR comments; scans all configured routes (route→file
  mapping is v1.5); GitHub only.
