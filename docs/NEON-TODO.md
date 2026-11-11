# Neon migration TODO

Created: 2026-11-11. Status: planned; no database or deployment changes performed.

## Goal and approach

Use Neon as Intygy's only hosted database provider. Supabase project pauses are
disrupting availability, and Intygy currently uses none of its Auth, Storage,
Realtime, or client SDK capabilities.

Keep the Node API, `pg.Pool`, SQL schema, and existing transaction boundaries.
Local development and CI may continue using ordinary Postgres or PGlite; they do
not need hosted Neon databases. No new production dependency is expected.

Estimated effort: 1–2 hours for a fresh database; roughly half a day for a small
existing database, including transfer and verification. Actual transfer time
depends on database size and access.

## 1. Prepare Neon

- [ ] Create a Neon project in an appropriate EU region, preferably near the API host.
- [ ] Choose compute and scale-to-zero settings deliberately. Automatic wake-up
  can add latency after inactivity; disable scale-to-zero if consistently fast
  first requests are required. Confirm current plan limits and backup retention.
- [ ] Store the SSL-enabled connection strings securely: pooled for API traffic,
  direct for schema administration and dump/restore. Never put values in this document.
- [ ] Confirm the target supports the schema's `pgcrypto` extension and SQL features.

## 2. Choose the database path

- [ ] Inventory the existing database: schema version, table sizes, row counts,
  and whether any customer data must be retained.
- [ ] **Fresh database only:** apply `db/schema.sql` through the direct connection.
- [ ] **Existing data:** take a recoverable backup and rehearse a scoped dump/restore
  into an isolated Neon database. Transfer Intygy tables and required objects;
  do not blindly import Supabase-managed schemas, roles, or ownership settings.
- [ ] Preserve installation IDs, project IDs, API keys, scan IDs, violations,
  baselines, attestations, baseline events, migration records, and sequence values.
- [ ] Check the source schema version before applying upgrades. If needed, apply
  `db/migrations/001-flow-integrity.sql` with writes stopped, following
  `INSTALL.md`. Do not combine an unverified fingerprint upgrade with the cutover.
- [ ] Compare source and restored row counts, constraints, indexes, relationships,
  baseline state, and representative evidence history.

## 3. Configuration and documentation

- [ ] Point the API deployment's `DATABASE_URL` at Neon using its supplied TLS settings.
- [ ] Update the ignored local `packages/api/.env` if local development should use Neon.
- [ ] Retain `packages/api/src/lib/db.ts` and its checked-out-client transaction
  implementation unless live verification reveals a specific compatibility issue.
- [ ] Replace Supabase setup and SQL-editor instructions in `docs/INSTALL.md` with
  Neon instructions, including manual project API-key retrieval.
- [ ] Update `packages/api/.env.example` with a credential-free Neon URL example;
  explain pooled runtime versus direct administrative connections.
- [ ] Keep `README.md` and `docs/ARCHITECTURE.md` aligned with the selected hosting
  and idle-wake behavior. Add the implemented change to `CHANGELOG.md` when delivered.
- [ ] Keep customer Action configuration and payload contracts unchanged for this
  database-provider switch. Publish a new Action only if separate Action changes require it.

## 4. Verify before cutover

- [ ] Run `pnpm test` and `pnpm typecheck` after repository edits.
- [ ] Run SQL integration tests against a **disposable** Neon database using
  `INTYGY_TEST_DATABASE_URL`; first inspect test setup/cleanup behavior. Never
  point the test suite at the production destination.
- [ ] Verify concurrent ingestion and transaction rollback against real Neon Postgres.
- [ ] Exercise the deployed API: GitHub installation webhook, authenticated ingestion,
  first-scan baseline, new PR violation blocking, default-branch resolution,
  retry replay, scan reports, and evidence history.
- [ ] If scale-to-zero is enabled, let compute become idle and verify the first
  webhook and scan after wake-up succeed within caller timeouts. Address failures
  with a focused change rather than adding speculative retry infrastructure.
- [ ] Record unit/typecheck results separately from live Neon and GitHub checks.

## 5. Cut over and retire Supabase

- [ ] Schedule a short write-maintenance window. Pause scan submissions and account
  for incoming GitHub webhooks; record failed deliveries for redelivery.
- [ ] Stop API writes, take the final backup, and restore the final data to Neon.
- [ ] Recheck data integrity, update the deployed `DATABASE_URL`, and restart the API.
- [ ] Verify actual database-backed requests; `/healthz` checks only the API process.
- [ ] Resume scans, redeliver missed webhooks, and verify a current default-branch scan.
- [ ] Monitor database errors, wake-up latency, connection usage, and scan results.
- [ ] Retain the source database and backup for an agreed rollback period. Before
  Neon accepts writes, rollback is switching back to the untouched source. After
  new writes, stop traffic and reconcile or transfer those writes before rollback;
  switching URLs alone would lose accepted scans and history.
- [ ] After acceptance and the rollback period, remove obsolete Supabase credentials
  from deployments and local configuration, then retire the Supabase project.

## Completion criteria

- [ ] All hosted API database traffic uses Neon; Supabase is no longer required.
- [ ] Existing customer keys and evidence history remain intact where data was migrated.
- [ ] Scan and baseline behavior is unchanged, including atomic writes and comments after commit.
- [ ] Setup documentation uses Neon and explains any configured idle-wake behavior.
- [ ] Dashboard and evidence routes remain documented as unauthenticated UUID URLs;
  changing database providers does not add access control or establish full compliance.

References: [Neon connections](https://neon.com/docs/get-started/connect-neon),
[connection pooling](https://neon.com/docs/connect/connection-pooling),
[compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle).
