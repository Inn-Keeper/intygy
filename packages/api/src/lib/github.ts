import { App } from "octokit";

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
