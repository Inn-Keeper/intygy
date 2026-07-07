import type { ScanPayload, IngestResponse } from "../../shared/types";

export async function submitScan(apiBase: string, apiKey: string, payload: ScanPayload): Promise<IngestResponse> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Intygy API responded ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as IngestResponse;
}
