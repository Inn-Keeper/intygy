# Scan lifecycle repairs implementation plan

> Execute inline with superpowers:executing-plans. User authorized all twelve review fixes and subsequently requested a separate commit for each fix.

**Goal:** Make regression checks, baseline state, retries, and evidence reflect the application actually scanned.

**Architecture:** Keep customer-side Playwright scanning and the Hono/Postgres API. Extract ingest and webhook operations from server startup so integration tests can exercise the real handlers. Serialize each project's ingest with a database row lock. Verify default branch and commit ancestry through the installed GitHub App before mutating an established baseline.

**Constraints:** Preserve existing working-tree transaction changes, public UUID dashboard/evidence URLs, manual key retrieval, partial criteria coverage, and first-scan non-blocking behavior. No production dependencies. Rebuild the committed Action bundle. Migration must retain legacy findings and dated resolutions; never silently rebaseline all current issues.

## Tasks

- [x] 1. Add failing tests for per-element identity and the versioned payload; implement exact-selector fingerprints and a migration preserving the legacy first element only. Other previously unrecorded nodes must be treated as new.
- [x] 2. Add ingest integration tests; implement per-project locking, verified baseline authority/ancestry, coverage-aware resolution, immutable result replay, and baseline events. Legacy clients fail explicitly with an upgrade message instead of mutating state without coverage.
- [x] 3. Add scanner tests for bad responses, redirects and unsuccessful login; require readiness checks, retain all axe nodes, and submit complete coverage with a stable run identifier.
- [x] 4. Test webhook provisioning/revocation; synchronize default branch and installation authorization. Removed/suspended projects cannot ingest. Reauthorization rotates keys after removal.
- [x] 5. Test evidence and dashboard output; derive evidence from successful coverage, expose all stored findings and lifecycle events, and distinguish scans from merges.
- [x] 6. Update setup/architecture examples and migration instructions. Run tests, typecheck, Action build and generated diff review. Obtain one fresh read-only review and address material issues.

## Decisions and progress

- Authorization: “Fix all the findings” accepts the prior review's fixes; implementation proceeds without another design approval cycle.
- Existing branch is `release/v1`; work stays here to preserve the user's uncommitted changes.
- Verification baseline: 11 tests pass via Node's tsx import; pnpm's tsx CLI cannot open IPC in the sandbox. Typecheck passes. No local Postgres or running Docker daemon found.
- Coverage compatibility means equal route/viewport/ruleset scope for resolution of each finding; missing scope remains open and visibly unverified.
- Retry identity is a UUID created once per Action invocation (network retries reuse it; other steps, matrix jobs and user reruns are new scans). Persist the response in the scan transaction and reject reuse with a changed payload.
- Evidence says “no automated findings” only for recorded coverage, never full criterion conformance.

- Tasks 1–5: regression tests failed on the original behavior, then passed after fixes. SQL rollback uses a failing database trigger; migration runs twice to test replay safety.
- Ruling: current-head verification under the project lock replaces ancestry comparisons. It prevents late old runs from changing baseline state, including after force pushes. Tradeoff: a superseded default-branch scan stays history-only.
- Added development-only PGlite for real SQL tests. CI now supplies native Postgres for independent-connection locking tests; PGlite itself serializes transactions.
- Browser installation failed with ENOSPC; installed Chrome successfully runs the real scanner regression fixtures via a test-only launch override.
- Fresh read-only review found URL normalization origin escape and submission-ID collisions across steps. Both fixed; route normalization has a failing-then-passing regression test.
- Native lock verification and a real hosted GitHub installation are still environment-dependent acceptance checks.

- Final reviewer follow-up found no material issues in the fixes or native-PG harness. Source suite passed 39 tests. A new generated-bundle smoke test then caught captured-variable minification in the axe browser callback; explicit `window.axe` fixes the artifact boundary.

## Delivery map

- Findings 1–4, 7–9: `packages/api/src/lib/ingest.ts`, `fingerprint.ts`, `payload.ts`, `github.ts`, `packages/shared/types.ts`, `db/schema.sql`, and migration `001-flow-integrity.sql`.
- Finding 5: Action `config.ts`, `scan.ts`, `index.ts`; required readiness/authentication markers and explicit destination validation.
- Findings 6 and 10: API `evidence.ts`, new `report.ts`, testable `app.ts`, and slim server `index.ts`.
- Finding 11: new API `webhook.ts`, active authorization checks and key rotation.
- Finding 12: Action configuration, transport, browser and committed-bundle tests; API lifecycle, migration, webhook and reporting integration tests. Native Postgres adapter in `test/database.ts`; CI supplies Postgres and Chromium.
- Supporting delivery: root package/lockfile (development-only PGlite), rebuilt `packages/action/dist/index.js`, README, architecture/install docs, Action metadata, workflow/config examples and environment example.
- Existing user transaction wrapper and tests remain intact. The implementation phase performed no commit, deployment or live migration; focused commits were subsequently requested.

## Operator follow-up

Back up the database, stop the API, apply migration 001, deploy the matching API/Action,
grant Contents read to the GitHub App, and add `readySelector` plus authenticated
`success_selector` configuration. Run the live acceptance sequence in ARCHITECTURE.md.
Native Postgres and real GitHub permissions/preview deployments were not exercised locally.

## Final verification

- `INTYGY_TEST_BROWSER_CHANNEL=chrome pnpm test`: 40 passed, 0 failed, 0 skipped. Includes executing the rebuilt committed Action against a real browser and local ingest fixture.
- `pnpm typecheck`: both packages passed.
- `pnpm build:action`: passed; generated `packages/action/dist/index.js` (799 kB). Only that generated bundle changed; no native binaries added.
- `git diff --check`: passed.
- Not run locally: native multi-connection Postgres (no service available), live GitHub App/webhook permissions, production preview targets, hosted API, or deployment/migration. Native Postgres is wired into CI but that CI run has not been observed here.
