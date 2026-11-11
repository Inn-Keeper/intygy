import { createHash, randomUUID } from "node:crypto";
import type { Query } from "./db.js";
import { openBaselineFingerprints } from "./db.js";
import { fingerprint } from "./fingerprint.js";
import type { ScanPayload, IngestResponse, Violation } from "../../../shared/types";

export class IngestError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 409) {
    super(message);
  }
}

export type VerifyRepository = (installationId: number, repo: string) =>
  Promise<{ defaultBranch: string; headSha: string }>;

/** Called inside a single transaction. The project lock serializes all decisions. */
export async function ingest(query: Query, apiKey: string, payload: ScanPayload, baseUrl: string, verify: VerifyRepository) {
  const [project] = await query<{
    id: string; repo: string; installation_id: number | null; active: boolean; baseline_initialized: boolean;
  }>("select id, repo, installation_id, active, baseline_initialized from projects where api_key = $1 for update", [apiKey]);

  if (!project) throw new IngestError("unknown api key", 401);
  if (project.repo !== payload.repo) throw new IngestError("api key does not belong to this repository", 403);

  const [installation] = await query<{ active: boolean }>("select active from installations where id=$1", [project.installation_id]);

  if (!project.active || !installation?.active || !project.installation_id) {
    throw new IngestError("GitHub installation or repository access is inactive", 403);
  }

  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const [previous] = await query<{ payload_hash: string; result: IngestResponse }>(
    "select payload_hash, result from scans where project_id=$1 and submission_id=$2", [project.id, payload.submissionId]
  );

  if (previous) {
    if (previous.payload_hash !== hash) throw new IngestError("submissionId already used for a different payload", 409);

    return { response: previous.result, newViolations: [], installationId: project.installation_id, projectId: project.id, replay: true };
  }

  // Read GitHub under the project lock so a queued older scan cannot use a stale
  // head snapshot to overwrite a newer accepted scan. GitHub failures roll back.
  const repository = await verify(project.installation_id, project.repo);
  const isDefault = !payload.prNumber && payload.branch === repository.defaultBranch;
  const stale = isDefault && payload.sha !== repository.headSha;

  if (stale && !project.baseline_initialized) throw new IngestError("first scan is stale; scan the current default-branch head", 409);

  const first = !project.baseline_initialized;
  const updateBaseline = first || (isDefault && !stale);
  const scanId = randomUUID();
  const seen = new Map<string, Violation>();

  for (const violation of payload.violations) {
    for (const node of violation.nodes) {
      const element = { ...violation, nodes: [node] };

      seen.set(fingerprint(element), element);
    }
  }

  const baseline = await openBaselineFingerprints(project.id, query);
  const newViolations = [...seen].filter(([fp]) => !baseline.has(fp)).map(([, v]) => v);

  await query(
    `insert into scans (id, project_id, sha, branch, pr_number, ruleset, routes, viewports,
      started_at, finished_at, submission_id, payload_hash, baseline_updated, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp())`,
    [scanId, project.id, payload.sha, payload.branch ?? null, payload.prNumber ?? null, payload.ruleset,
      JSON.stringify(payload.routesScanned), JSON.stringify(payload.viewports), payload.startedAt, payload.finishedAt,
      payload.submissionId, hash, updateBaseline]
  );

  for (const [fp, v] of seen) {
    await query(
      `insert into violations (id, scan_id, fingerprint, rule_id, wcag, impact, route, viewport, selector, description, help_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID(), scanId, fp, v.ruleId, JSON.stringify(v.wcag), v.impact, v.route, v.viewport,
        v.nodes[0].selector, v.description, v.helpUrl]
    );
  }

  if (updateBaseline) {
    for (const [fp, v] of seen) {
      const [old] = await query<{ resolved_at: Date | null }>(
        "select resolved_at from baselines where project_id=$1 and fingerprint=$2", [project.id, fp]
      );

      await query(
        `insert into baselines (project_id, fingerprint, route, viewport, ruleset, rule_id, selector)
         values ($1,$2,$3,$4,$5,$6,$7) on conflict (project_id,fingerprint)
         do update set resolved_at=null, ruleset=excluded.ruleset`,
        [project.id, fp, v.route, v.viewport, payload.ruleset, v.ruleId, v.nodes[0].selector]
      );

      if (!old || old.resolved_at) {
        await query("insert into baseline_events(project_id,fingerprint,scan_id,kind) values($1,$2,$3,$4)",
          [project.id, fp, scanId, old ? "reopened" : "observed"]);
      }
    }

    if (!first) {
      const cleared = await query<{ fingerprint: string }>(
        `update baselines set resolved_at=now() where project_id=$1 and resolved_at is null
         and route = any($2::text[]) and viewport = any($3::text[]) and ruleset=$4
         and not (fingerprint = any($5::text[])) returning fingerprint`,
        [project.id, payload.routesScanned, payload.viewports, payload.ruleset, [...seen.keys()]]
      );

      for (const { fingerprint: fp } of cleared) {
        await query("insert into baseline_events(project_id,fingerprint,scan_id,kind) values($1,$2,$3,'resolved')", [project.id, fp, scanId]);
      }
    }

    await query("update projects set baseline_initialized=true where id=$1", [project.id]);
  }

  await query("update projects set default_branch=$2 where id=$1", [project.id, repository.defaultBranch]);

  const response: IngestResponse = {
    scanId,
    newCount: payload.prNumber && !first ? newViolations.length : 0,
    baselineOpenCount: (await openBaselineFingerprints(project.id, query)).size,
    blocked: Boolean(payload.prNumber && !first && newViolations.length),
    dashboardUrl: `${baseUrl}/p/${project.id}/scans/${scanId}`,
    baselineUpdated: updateBaseline,
    ...(!updateBaseline && !payload.prNumber ? { notice: stale
      ? "Stale default-branch scan recorded; baseline unchanged."
      : "Non-default-branch scan recorded; baseline unchanged." } : {}),
  };

  await query("update scans set result=$2 where id=$1", [scanId, JSON.stringify(response)]);

  return { response, newViolations, installationId: project.installation_id, projectId: project.id, replay: false };
}
