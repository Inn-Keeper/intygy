import { spawn, execSync } from "node:child_process";
import * as core from "@actions/core";
import * as github from "@actions/github";
import type { IntygyConfig } from "./config";
/** Runtime-installed deps; must equal the installed versions (test/target.test.ts enforces it). */
export const PLAYWRIGHT_VERSION = "1.61.1";
export const AXE_CORE_VERSION = "4.12.1";

/** Poll a URL until it responds (any status < 500 counts as up). */
async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${url} to become reachable.`);
}

/** Find the Vercel/Netlify-style preview deployment for this commit via the GitHub Deployments API. */
async function resolvePreviewUrl(sha: string, timeoutMs = 300_000): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "target: preview requires GITHUB_TOKEN. Add `env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }` to the Intygy step."
    );
  }
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const deployments = await octokit.rest.repos.listDeployments({ owner, repo, sha, per_page: 10 });
    for (const d of deployments.data) {
      const statuses = await octokit.rest.repos.listDeploymentStatuses({
        owner,
        repo,
        deployment_id: d.id,
        per_page: 10,
      });
      const ok = statuses.data.find((s) => s.state === "success" && s.environment_url);
      if (ok?.environment_url) {
        core.info(`Found preview deployment: ${ok.environment_url}`);
        return ok.environment_url;
      }
    }
    core.info("Waiting for preview deployment to finish building…");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(
    "No successful preview deployment found for this commit. " +
      "If you don't use Vercel/Netlify previews, set an explicit target url or a serve command in intygy.yml."
  );
}

export interface ResolvedTarget {
  baseUrl: string;
  /** Kill the locally served app when done. */
  cleanup: () => void;
}

export async function resolveTarget(config: IntygyConfig, sha: string): Promise<ResolvedTarget> {
  const t = config.target;

  if (t === "preview") {
    return { baseUrl: await resolvePreviewUrl(sha), cleanup: () => {} };
  }

  if ("serve" in t) {
    core.info(`Starting app: ${t.serve}`);
    const child = spawn(t.serve, { shell: true, stdio: "inherit", detached: true });
    const cleanup = () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    };
    try {
      await waitForUrl(t.url, t.readyTimeoutMs);
    } catch (e) {
      cleanup();
      throw e;
    }
    return { baseUrl: t.url, cleanup };
  }

  return { baseUrl: t.url, cleanup: () => {} };
}

/** Ensure a Chromium build exists on the runner (cached by GitHub between runs of the same workflow). */
export function ensureBrowser(): void {
  if (process.env.INTYGY_SKIP_BROWSER_INSTALL === "1") return;
  core.info(`Installing Playwright ${PLAYWRIGHT_VERSION}, axe-core ${AXE_CORE_VERSION} + Chromium…`);
  // Neither survives bundling (playwright reads its own files from disk; axe-core's `source` is its
  // own minified function text), so both are installed next to dist/index.js, where Node resolves them.
  execSync(
    `npm install --no-save --no-package-lock --prefix "${__dirname}" playwright@${PLAYWRIGHT_VERSION} axe-core@${AXE_CORE_VERSION}`,
    { stdio: "inherit" }
  );
  execSync("npx playwright install --with-deps chromium", { cwd: __dirname, stdio: "inherit" });
}
