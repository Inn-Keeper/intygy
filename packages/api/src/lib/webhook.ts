import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Query } from "./db.js";
import type { VerifyRepository } from "./ingest.js";

const Repository = z.object({ full_name: z.string().regex(/^[^/]+\/[^/]+$/) });

export const WebhookSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number().int().positive(), account: z.object({ login: z.string() }).optional() }),
  repositories: z.array(Repository).optional(),
  repositories_added: z.array(Repository).optional(),
  repositories_removed: z.array(Repository).optional(),
});

export async function applyWebhook(query: Query, event: string, data: z.infer<typeof WebhookSchema>, verify: VerifyRepository) {
  const installationId = data.installation.id;

  if (event === "installation" && ["deleted", "suspend"].includes(data.action)) {
    // Wait for in-flight ingests before revocation commits, including suspension
    // which keeps each repository's active flag for a later unsuspension.
    await query("select id from projects where installation_id=$1 order by id for update", [installationId]);
    await query("update installations set active=false where id=$1", [installationId]);
    if (data.action === "deleted") {
      await query("update projects set active=false where installation_id=$1", [installationId]);
    }

    return;
  }

  if (event === "installation" && !["created", "unsuspend"].includes(data.action)) return;
  if (event !== "installation" && event !== "installation_repositories") return;

  await query("insert into installations(id,account) values($1,$2) on conflict(id) do nothing",
    [installationId, data.installation.account?.login ?? ""]);

  if (event === "installation") {
    await query("update installations set active=true where id=$1", [installationId]);
  }

  for (const repo of data.repositories_removed ?? []) {
    await query("update projects set active=false where installation_id=$1 and repo=$2", [installationId, repo.full_name]);
  }

  for (const repo of data.repositories_added ?? data.repositories ?? []) {
    const repository = await verify(installationId, repo.full_name);
    const key = "igy_" + randomBytes(24).toString("hex");

    await query(
      `insert into projects(id,repo,installation_id,api_key,default_branch) values($1,$2,$3,$4,$5)
       on conflict(repo) do update set installation_id=excluded.installation_id,
         default_branch=excluded.default_branch, active=true,
         api_key=case when not projects.active or projects.installation_id is distinct from excluded.installation_id
           then excluded.api_key else projects.api_key end`,
      [randomUUID(), repo.full_name, installationId, key, repository.defaultBranch]
    );
  }
}
