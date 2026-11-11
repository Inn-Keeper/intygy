# Intygy — MVP

Accessibility compliance, reviewed in every pull request. Blocks new WCAG 2.2 violations
at the PR and compiles an EN 301 549 evidence dossier from your merge history.

See [CHANGELOG.md](CHANGELOG.md) for changes, compatibility notes, and upgrade steps.

## Repo layout

```text
packages/action   TypeScript GitHub Action: Playwright + axe-core scanner → posts to the API
packages/api      Hono (Node) API: ingest, baseline diffing, PR comments, dashboard, evidence
packages/shared   Payload types shared by both
db/schema.sql     Postgres schema
examples/         Workflow + intygy.yml templates for customer repos
docs/INSTALL.md      Step-by-step: run this on YOUR GitHub today
docs/ARCHITECTURE.md Components, auth, scan lifecycle, testing
```

## How it fits together

1. Customer repo runs the **Action** on every PR and every push to `main` (their CI minutes).
   It resolves a rendered app (preview URL or `serve` command), scans configured routes with
   axe-core, and POSTs results to the API with the project's key.
2. The **API** fingerprints each failing element (`rule|route|viewport|exact selector`), diffs against the
   project **baseline**, comments on the PR via the GitHub App when new violations appear,
   and returns `blocked: true` so the Action fails the check. Each scan and its baseline changes
   commit in one database transaction; a failed ingest leaves neither partial history nor a
   partial baseline update.
3. First scan = baseline (nothing blocks). Verified current-head scans of the default branch update the baseline
   and mark disappeared issues as resolved only within matching scan coverage — that dated history feeds the **evidence dossier**
   (`/p/:id/evidence`).

## Commands

```bash
pnpm install                # workspace deps (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 locally)
pnpm test                   # SQL integration + browser tests (install Chromium first)
pnpm typecheck              # both packages
pnpm build:action           # bundles packages/action/dist (commit it; CI fails if stale)
pnpm dev:api                # local API on :3000 (needs DATABASE_URL)
```

## Upgrade existing installations

Apply [migration 001](db/migrations/001-flow-integrity.sql) with the API stopped, then deploy
the API and rebuilt Action together. Payload version 2 requires coverage and a retry ID;
old Actions fail explicitly. Customer configs now need `readySelector` and authenticated
scans need `auth.success_selector`. See [INSTALL.md](docs/INSTALL.md) for the rollout.

Scan reports expose every finding. Evidence shows recorded coverage and immutable issue
events; it never treats missing coverage or a green scan as full conformance.

## Honest MVP boundaries (do before charging money)

- **Dashboard/evidence routes have no user login** — they open through signed links that
  expire after 30 days, and anyone holding a link can read the project. Add real auth.
- API key retrieval is manual (`select api_key from projects`) — build the onboarding page.
- `CRITERIA` in `evidence.ts` is a 15-item subset — extend to the full WCAG 2.2 AA list.
- No Stripe yet; no screenshots in PR comments; scans all configured routes (route→file
  mapping is v1.5); GitHub only.
