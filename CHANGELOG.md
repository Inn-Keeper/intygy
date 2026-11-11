# Changelog

## Unreleased

### Scan lifecycle and architecture fixes — 2026-11-11

These changes have not been released, deployed, or applied to a live database.

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

### Verification recorded on 2026-11-11

- `INTYGY_TEST_BROWSER_CHANNEL=chrome pnpm test`: 40 passed, none failed or skipped.
- `pnpm typecheck`, `pnpm build:action`, and `git diff --check`: passed.
- Native multi-connection Postgres, live GitHub App permissions/webhooks, preview
  deployments, and hosted API behavior were not exercised locally. The new CI
  configuration has not yet been observed running.

Dashboard, scan-report, and evidence URLs remain unauthenticated UUID URLs. API-key
retrieval remains manual, and the criteria register remains a partial evidence set.
