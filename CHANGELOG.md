# Changelog

## Unreleased

### Workflow identity — 2026-11-11

Not yet released or deployed.

### Breaking changes

- Ingestion requires a GitHub Actions OIDC token. Customer workflows must grant
  `id-token: write`, and the Action's `api-base` must equal the API's
  `PUBLIC_BASE_URL`. Deploy the API and Action together; older Actions receive a
  401 that names the missing permission.

### Added

- Verify the workflow token on every scan and reject submissions whose repository,
  branch, commit, or pull request number differ from the run GitHub attests. A
  pull-request run holding the project key can no longer submit a default-branch
  scan and alter the baseline. Adds the `jose` dependency for token verification.

### Signed project links — 2026-11-11

Not yet released or deployed.

### Breaking changes

- Dashboard, scan report, and evidence pages require a signed link; bare
  `/p/<project id>` URLs return 404. The API needs a new `LINK_SIGNING_SECRET`
  variable and refuses to start without it. Set it before deploying.
- Links expire after 30 days. Links in earlier PR comments and run summaries stop
  working; any new scan issues a fresh one.

### Added

- Sign project links with an HMAC over the project ID and expiry. Ingest responses
  and PR comments carry a freshly signed link, including replayed submissions, and
  pages carry the visitor's signature through their own links. These remain bearer
  links without user login.

## 1.0.0 — 2026-11-11

### Scan lifecycle and architecture fixes

Released as `v1.0.0`. The hosted API and a fresh database were verified against one
test repository; see the live verification notes below.

### Breaking changes

- Ingestion requires payload version 2 with a submission ID and explicit viewport
  coverage. Deploy the updated API and Action together; older payloads receive an
  upgrade error.
- Customer configuration requires `readySelector`. Authenticated scans also require
  `auth.success_selector`, visible after login and on every scanned page.
- Fingerprints now identify individual failing elements using exact selectors.
  Previously discarded nodes, changed selectors, and structured iframe/shadow
  targets can produce new blocking findings.
- The GitHub App needs **Contents: Read-only** to verify the default-branch head.
  Repository verification failures prevent ingestion rather than accepting an
  unverified baseline update.

### Fixed

- Retain every failing axe node and compare each element independently. Adding an
  inaccessible element can no longer hide behind an existing rule-level finding;
  reordering the reported nodes does not change their identities.
- Restrict established-baseline updates to verified current-head default-branch
  scans. Feature-branch scans cannot accept debt. Discover the real default branch
  during provisioning and refresh it during ingestion.
- Serialize ingestion per project so concurrent initial scans establish one
  baseline. Delayed default-branch scans remain in history without overwriting
  newer baseline state. A stale scan cannot initialize the baseline.
- Resolve missing findings only within matching route, viewport, and ruleset
  coverage. Removing coverage no longer records untested issues as fixed.
- Reject HTTP errors, unexpected redirects, missing readiness, unsuccessful login,
  and routes that escape the target origin through URL normalization.
- Replay the original committed response for transport retries. Reusing a submission
  ID with different content returns 409. Each Action invocation gets a unique ID,
  including separate steps and matrix jobs; retries reuse its exact payload.
- Keep scan, finding, baseline, event, and response writes in one transaction.
  Post PR comments only after commit; comment failures leave accepted scans intact,
  and replays do not duplicate comments.
- Preserve dated resolution and reopening events instead of overwriting history.
- Derive evidence from recorded default-branch results and coverage. Show unknown
  coverage and open findings; stop claiming verification without results or counting
  PR scans as merges. Automated scans do not establish full conformance.
- Expose every stored finding in project-scoped scan reports, including findings
  beyond the PR comment's 20-item limit and scans whose comments failed.
- Disable ingestion for removed repositories and deleted or suspended installations.
  Rotate keys when removed repositories are re-added or installations change.
- Fix axe-core module loading and browser-global access in the minified Action bundle.

### Testing and tooling

- Add SQL integration tests for ingestion, rollback, coverage, retries, migration,
  authorization, history, and reporting, plus browser and committed-bundle tests.
- Add development-only PGlite for local SQL tests. CI supplies PostgreSQL 16 for
  independent-connection tests and Chromium for browser tests.
- Rebuild `packages/action/dist/index.js` and update Action metadata, configuration
  examples, workflow permissions, and installation/architecture documentation.

### Upgrade

1. Back up the database and stop the API.
2. Apply [migration 001](db/migrations/001-flow-integrity.sql). Fresh installations
   use `db/schema.sql` instead.
3. Deploy the matching API and Action, grant the App Contents read permission, and
   update customer readiness/authentication selectors.
4. Retrieve replacement keys for reauthorized repositories and run a current
   default-branch scan.

The migration preserves the latest recorded legacy first selector, its original
fingerprint, and available first-seen/resolution dates. Unmappable baseline rows
remain unchanged. Previously discarded nodes and overwritten historical cycles
cannot be recovered. See [installation and rollback instructions](docs/INSTALL.md).

### Changed

- Document Neon as the hosted Postgres provider in place of Supabase: pooled runtime
  versus direct administrative connection strings and idle-wake behavior. No code,
  schema, or payload changes.

### Fixed (documentation)

- Correct the GitHub App permissions: commenting on pull requests needs
  **Pull requests: Read & write**. With read-only access the scan was accepted and
  the check failed, but no PR comment appeared.

### Added

- Send `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, and
  `Cache-Control: private, no-store` on dashboard, scan report, and evidence pages.
  The URLs remain unauthenticated; this only limits how they leak.

### Fixed

- Return 404 instead of a 500 for dashboard, evidence, and scan report URLs whose
  project or scan ID is not a UUID.

### Live verification on 2026-11-11

Against the hosted API, a fresh Neon database, and one public test repository:
installation webhook provisioning, non-blocking first baseline, PR blocking with
a PR comment, unblocking after the fix, verified default-branch scans, and the
dashboard, scan report, and evidence pages. Not exercised live: resolved-issue
history, retry replay, authenticated scans, and migration 001 on existing data.

### Verification recorded on 2026-11-11

- `INTYGY_TEST_BROWSER_CHANNEL=chrome pnpm test`: 40 passed, none failed or skipped.
- `pnpm typecheck`, `pnpm build:action`, and `git diff --check`: passed.
- Native multi-connection Postgres, live GitHub App permissions/webhooks, preview
  deployments, and hosted API behavior were not exercised locally. The new CI
  configuration has not yet been observed running.

Dashboard, scan-report, and evidence URLs remain unauthenticated UUID URLs. API-key
retrieval remains manual, and the criteria register remains a partial evidence set.
