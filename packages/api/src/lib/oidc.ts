import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { ScanPayload } from "../../../shared/types";

const ISSUER = "https://token.actions.githubusercontent.com";
const keys = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const Claims = z.object({ repository: z.string(), ref: z.string(), sha: z.string() });

/** What GitHub attests about the workflow run that produced a scan. */
export interface WorkflowIdentity {
  repo: string;
  ref: string;
  sha: string;
}

export type VerifyWorkflowToken = (token: string, audience: string) => Promise<WorkflowIdentity>;

/** Verify a GitHub Actions OIDC token: signature, issuer, audience, and expiry. */
export const verifyWorkflowToken: VerifyWorkflowToken = async (token, audience) => {
  const { payload } = await jwtVerify(token, keys, { issuer: ISSUER, audience });
  const claims = Claims.parse(payload);

  return { repo: claims.repository, ref: claims.ref, sha: claims.sha };
};

/**
 * Compare the self-reported scan context with the signed workflow identity.
 * Returns a reason when they disagree. A pull-request run can therefore never
 * submit a branch scan, which is the only kind that updates the baseline.
 */
export function contextMismatch(identity: WorkflowIdentity, payload: ScanPayload): string | null {
  if (identity.repo !== payload.repo) return "repository";

  const pr = /^refs\/pull\/(\d+)\/merge$/.exec(identity.ref);

  // GitHub signs the merge commit for pull requests, so the head SHA stays self-reported.
  if (pr) return payload.prNumber === Number(pr[1]) ? null : "pull request number";
  if (payload.prNumber) return "pull request number";
  if (payload.branch !== identity.ref.replace(/^refs\/heads\//, "")) return "branch";

  return payload.sha === identity.sha ? null : "commit";
}
