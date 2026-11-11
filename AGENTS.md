# AGENTS.md

Guidance for working on Intygy, an accessibility-compliance MVP that scans
customer applications in GitHub Actions, blocks new WCAG 2.2 violations, and
builds an EN 301 549 evidence history.

Read `README.md` for product behavior, `docs/ARCHITECTURE.md` for runtime and
trust boundaries, and `docs/INSTALL.md` before changing setup or deployment.

## Stack and layout

- TypeScript pnpm workspace targeting Node.js.
- `packages/action/`: GitHub Action using Playwright, axe-core, YAML, and Zod.
- `packages/api/`: Hono API using Postgres, Octokit, and Zod.
- `packages/shared/types.ts`: payload types shared by the Action and API.
- `db/schema.sql`: Postgres schema for projects, scans, violations, baselines,
  and attestations.
- `examples/`: customer workflow and `intygy.yml` templates.
- `docs/`: installation, architecture, and positioning documentation.

pnpm is canonical; keep `pnpm-lock.yaml` and the root `packageManager` version
authoritative. `packages/shared` is intentionally types-only and has no
`package.json`.

## Working Principles

- YAGNI over SOLID; no speculative extension systems (the design doc says so too).
  Apply SOLID or inversion only to fix a current cost: a bug, duplication at 3+
  sites, or code that can't be tested. No interface with one implementation, no
  extension point for variants that don't exist yet.
- Keep changes small, focused and reviewable; avoid unrelated refactors.
- Prefer existing patterns. Do not add production dependencies without saying why.
- Write comments that explain what and why. Keep descriptions concise.
- Leave one blank line before variable/function declarations and between class fields and methods, except at the start of a block. `npm run format` applies this with Prettier and ESLint layout fixes.
- Preserve accessibility (labelled buttons, live status), responsive layout and type safety.
- Ask when requirements are unclear. For non-trivial features, state the approach and wait for confirmation.
- Never print, log or commit secrets.

## Product invariants

- The first successful scan establishes the baseline and must not block.
- Pull-request scans compare against the open baseline and block only on new
  violation fingerprints.
- Default-branch scans update the baseline and record resolved violations.
- Keep fingerprint behavior stable unless a migration strategy accounts for
  existing baseline rows.
- Keep `ScanPayload` and `IngestResponse` compatible across the Action and API.
  Update both consumers and focused tests when either contract changes.
- Preserve the ingest transaction boundary: scan, violation, baseline, and
  resolution writes commit or roll back together.
- Post GitHub comments only after the database transaction commits. A GitHub
  failure must not roll back an accepted scan.
- Treat project API keys, GitHub workflow (OIDC) tokens, and webhook signatures as
  authentication boundaries. Scan context must match the verified workflow token.
  Dashboard and evidence routes remain unauthenticated UUID URLs in the MVP;
  do not describe them as private or suitable for confidential data.
- Keep customer repositories isolated by project. Never accept repository or
  project identity from an unauthenticated source without checking it against
  the authenticated project.

## GitHub Action bundle

- `packages/action/dist/index.js` is generated but intentionally committed so
  repositories can use the Action directly from GitHub.
- Change Action source under `packages/action/src/`, then rebuild with
  `pnpm build:action` and include the resulting bundle when delivery requires a
  runnable Action.
- Do not hand-edit `dist/` or commit platform-specific native artifacts such as
  `fsevents.node`.
- Keep `action.yml`, workflow examples, Action inputs, and runtime behavior in
  sync.

## Verification

Run the narrowest relevant check while iterating, then run:

```sh
pnpm test
pnpm typecheck
```

Run `pnpm build:action` for changes to Action source, dependencies, metadata,
or shared types used by the Action. Confirm `packages/action/dist/index.js`
exists and review its generated diff.

Database, GitHub App, preview deployment, and hosted API behavior require their
respective services. Report those checks separately rather than implying the
unit tests or typecheck exercised them.

## Documentation and delivery

- Keep `README.md`, `docs/ARCHITECTURE.md`, `docs/INSTALL.md`, `action.yml`,
  `examples/`, and environment examples aligned with behavior and configuration
  changes.
- Preserve honest MVP boundaries: unauthenticated dashboard/evidence routes,
  manual API-key retrieval, the partial evidence criteria set, and GitHub-only
  support unless the implementation changes.
- Do not claim full WCAG or EN 301 549 compliance from axe-core scans alone.
- Commit only when asked. Do not add AI co-author or generated-by trailers.
- In the handoff, list files changed, commands run, skipped checks, and manual
  follow-up.

## Changelog

CHANGELOG.md records notable changes, newest entry first, one
dated entry per day, grouped into Added / Changed / Fixed. Leave earlier entries
untouched; the file is a history, not a summary of the latest state.
