import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params as any[]);
  return res.rows;
}

export async function openBaselineFingerprints(projectId: string): Promise<Set<string>> {
  const rows = await q<{ fingerprint: string }>(
    "select fingerprint from baselines where project_id = $1 and resolved_at is null",
    [projectId]
  );
  return new Set(rows.map((r) => r.fingerprint));
}
