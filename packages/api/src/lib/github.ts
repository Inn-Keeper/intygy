import { App } from "octokit";
import type { VerifyRepository } from "./ingest.js";

let app: App | null = null;

export function getApp(): App {
  if (!app) {
    const privateKey = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_B64 ?? "", "base64").toString("utf8");
    app = new App({
      appId: process.env.GITHUB_APP_ID ?? "",
      privateKey,
      webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET ?? "" },
    });
  }
  return app;
}

export async function commentOnPr(
  installationId: number,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const [owner, name] = repo.split("/");
  const octokit = await getApp().getInstallationOctokit(installationId);
  await octokit.rest.issues.createComment({ owner, repo: name, issue_number: prNumber, body });
}

/** Repository identity is supplied by the authenticated project, never a webhook URL or payload override. */
export const verifyRepository: VerifyRepository = async (installationId, repo) => {
  const [owner, name] = repo.split("/");
  const octokit = await getApp().getInstallationOctokit(installationId);
  const request = { timeout: 10_000 };
  const { data: repository } = await octokit.rest.repos.get({ owner, repo: name, request });
  const { data: branch } = await octokit.rest.repos.getBranch({
    owner, repo: name, branch: repository.default_branch, request,
  });

  return { defaultBranch: repository.default_branch, headSha: branch.commit.sha };
};
