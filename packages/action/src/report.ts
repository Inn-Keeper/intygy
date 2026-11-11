import { z } from "zod";
import type { ScanPayload, IngestResponse } from "../../shared/types";

const ResponseSchema = z.object({
  scanId: z.string().min(1),
  newCount: z.number().int().nonnegative(),
  baselineOpenCount: z.number().int().nonnegative(),
  blocked: z.boolean(),
  dashboardUrl: z.string().url(),
  baselineUpdated: z.boolean(),
  notice: z.string().optional(),
});

/** `workflowToken` is the GitHub OIDC token proving which workflow run produced the scan. */
export async function submitScan(apiBase: string, apiKey: string, workflowToken: string, payload: ScanPayload): Promise<IngestResponse> {
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;

    try {
      response = await fetch(`${apiBase.replace(/\/$/, "")}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "x-intygy-workflow-token": workflowToken },
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 2) throw error;

      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");

      if (attempt < 2 && (response.status >= 500 || response.status === 429)) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }

      throw new Error(`Intygy API responded ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const parsed = ResponseSchema.safeParse(await response.json().catch(() => null));

    if (!parsed.success) throw new Error("Intygy API returned an invalid ingest response.");

    return parsed.data;
  }

  throw new Error("Intygy API could not be reached.");
}
