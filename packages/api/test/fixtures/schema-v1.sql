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
