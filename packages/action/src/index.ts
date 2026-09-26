import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./config";
import { ensureBrowser, resolveTarget } from "./target";
import { runScan } from "./scan";
import { submitScan } from "./report";
import type { ScanPayload } from "../../shared/types";

async function main(): Promise<void> {
  const apiKey = core.getInput("api-key", { required: true });
  const apiBase = core.getInput("api-base", { required: true });
  const configPath = core.getInput("config-path") || "intygy.yml";

  const config = loadConfig(configPath);
  const ctx = github.context;
  const sha = ctx.payload.pull_request?.head?.sha ?? ctx.sha;
  const prNumber = ctx.payload.pull_request?.number;
  const branch = (ctx.payload.pull_request?.head?.ref as string | undefined) ?? ctx.ref.replace("refs/heads/", "");

  ensureBrowser();
  const startedAt = new Date().toISOString();
  const target = await resolveTarget(config, sha);
  try {
    const violations = await runScan(config, target.baseUrl);
    const payload: ScanPayload = {
      repo: `${ctx.repo.owner}/${ctx.repo.repo}`,
      sha,
      branch,
      prNumber,
      ruleset: config.ruleset,
      routesScanned: config.routes,
      startedAt,
      finishedAt: new Date().toISOString(),
      violations,
    };
    const result = await submitScan(apiBase, apiKey, payload);

    core.summary
      .addHeading("Intygy accessibility check")
      .addRaw(
        `New violations: **${result.newCount}** · Baseline (tracked, non-blocking): **${result.baselineOpenCount}** · ` +
          `[Dashboard](${result.dashboardUrl})`
      );
    await core.summary.write();

    if (result.blocked) {
      core.setFailed(
        `${result.newCount} new accessibility violation(s) introduced. See the Intygy comment on this PR for fixes.`
      );
    } else {
      core.info(`No new violations. Baseline open issues: ${result.baselineOpenCount}.`);
    }
  } finally {
    target.cleanup();
  }
}

main().catch((err) => core.setFailed(err instanceof Error ? err.message : String(err)));
