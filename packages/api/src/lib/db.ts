import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export type Query = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<T[]>;

export interface TransactionClient {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
  release(): void;
}

export const q: Query = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> => {
  const res = await pool.query<T>(text, params as any[]);
  return res.rows;
};

export async function runTransaction<T>(
  client: TransactionClient,
  work: (query: Query) => Promise<T>
): Promise<T> {
  const query: Query = async <R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<R[]> => {
    const res = await client.query(text, params as any[]);
    return res.rows as R[];
  };

  try {
    await client.query("BEGIN");
    try {
      const result = await work(query);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Transaction failed and rollback also failed");
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

export async function transaction<T>(work: (query: Query) => Promise<T>): Promise<T> {
  return runTransaction(await pool.connect(), work);
}

export async function openBaselineFingerprints(projectId: string, query: Query = q): Promise<Set<string>> {
  const rows = await query<{ fingerprint: string }>(
    "select fingerprint from baselines where project_id = $1 and resolved_at is null",
    [projectId]
  );
  return new Set(rows.map((r) => r.fingerprint));
}
