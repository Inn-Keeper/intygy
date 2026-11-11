-- Intygy MVP schema (Postgres 14+)
create extension if not exists pgcrypto;

create table if not exists installations (
  id          bigint primary key,          -- GitHub installation id
  account     text not null,
  created_at  timestamptz not null default now()
);

create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  repo            text not null unique,     -- "owner/name"
  installation_id bigint references installations(id),
  api_key         text not null unique,
  default_branch  text not null default 'main',
  created_at      timestamptz not null default now()
);

create table if not exists scans (
  id          uuid primary key,
  project_id  uuid not null references projects(id),
  sha         text not null,
  branch      text,
  pr_number   integer,
  ruleset     text not null,
  routes      jsonb not null,
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists scans_project_idx on scans(project_id, created_at desc);

create table if not exists violations (
  id          uuid primary key,
  scan_id     uuid not null references scans(id),
  fingerprint text not null,
  rule_id     text not null,
  wcag        jsonb not null,
  impact      text,
  route       text not null,
  viewport    text not null,
  selector    text not null,
  description text not null,
  help_url    text not null
);
create index if not exists violations_scan_idx on violations(scan_id);

-- The baseline: known issues that don't block; the burn-down and audit trail.
create table if not exists baselines (
  project_id  uuid not null references projects(id),
  fingerprint text not null,
  first_seen  timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (project_id, fingerprint)
);

-- Manual attestations for criteria automation can't verify.
create table if not exists attestations (
  project_id  uuid not null references projects(id),
  criterion   text not null,               -- e.g. "2.4.3"
  attested_by text not null,
  note        text,
  attested_at timestamptz not null default now(),
  primary key (project_id, criterion)
);

-- Flow integrity schema additions (also shipped as migration 001).
-- Apply with the API stopped. This transaction is safe to rerun.
BEGIN;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_initialized boolean NOT NULL DEFAULT false;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS submission_id text;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS payload_hash text;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS viewports jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS baseline_updated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS scans_submission_idx ON scans(project_id, submission_id);
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS viewport text;
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS ruleset text;
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS rule_id text;
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS selector text;
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS legacy_fingerprint text;
CREATE TABLE IF NOT EXISTS baseline_events (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  fingerprint text NOT NULL,
  scan_id uuid REFERENCES scans(id),
  kind text NOT NULL CHECK (kind IN ('observed', 'resolved', 'reopened')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'scan' CHECK (source IN ('scan', 'legacy'))
);
CREATE INDEX IF NOT EXISTS baseline_events_project_idx ON baseline_events(project_id, id);
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001-flow-integrity') THEN
    -- Legacy data retained only the first selector. Preserve that known debt;
    -- never absorb unrecorded additional nodes just to make the migration green.
    WITH latest AS (
      SELECT DISTINCT ON (s.project_id, v.fingerprint)
        s.project_id, v.fingerprint, v.rule_id, v.route, v.viewport, v.selector, s.ruleset
      FROM violations v JOIN scans s ON s.id = v.scan_id
      ORDER BY s.project_id, v.fingerprint, s.created_at DESC, s.id DESC
    )
    UPDATE baselines b SET legacy_fingerprint = b.fingerprint,
      fingerprint = 'v2:' || left(encode(digest(v.rule_id || '|' || v.route || '|' || v.viewport || '|' || v.selector, 'sha256'), 'hex'), 24),
      route = v.route, viewport = v.viewport, ruleset = v.ruleset, rule_id = v.rule_id, selector = v.selector
    FROM latest v WHERE b.project_id = v.project_id AND b.fingerprint = v.fingerprint
      AND b.fingerprint NOT LIKE 'v2:%';
    -- Unmappable legacy rows stay open/unchanged and are never auto-resolved.
    INSERT INTO baseline_events(project_id, fingerprint, kind, occurred_at, source)
      SELECT project_id, fingerprint, 'observed', first_seen, 'legacy' FROM baselines;
    INSERT INTO baseline_events(project_id, fingerprint, kind, occurred_at, source)
      SELECT project_id, fingerprint, 'resolved', resolved_at, 'legacy' FROM baselines WHERE resolved_at IS NOT NULL;
    UPDATE projects SET baseline_initialized = true WHERE EXISTS (SELECT 1 FROM scans WHERE project_id = projects.id);
    INSERT INTO schema_migrations VALUES ('001-flow-integrity');
  END IF;
END $$;
COMMIT;
