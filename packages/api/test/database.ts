import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { runTransaction } from "../src/lib/db.js";

type Sql = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
type TestDatabase = {
  query: Sql;
  exec: (sql: string) => Promise<unknown>;
  transaction: <T>(work: (tx: { query: Sql }) => Promise<T>) => Promise<T>;
};

/** Native Postgres in CI; embedded Postgres when no disposable service is configured. */
export async function database(t: TestContext): Promise<TestDatabase> {
  if (!process.env.INTYGY_TEST_DATABASE_URL) {
    const db = new PGlite({ extensions: { pgcrypto } });

    t.after(() => db.close());
    return db;
  }

  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: process.env.INTYGY_TEST_DATABASE_URL });

  await runTransaction(await admin.connect(), async (query) => {
    await query("select pg_advisory_xact_lock(141493281)");
    await query("create extension if not exists pgcrypto with schema public");
    await query(`create schema ${schema}`);
  });

  const pool = new pg.Pool({
    connectionString: process.env.INTYGY_TEST_DATABASE_URL,
    options: `-c search_path=${schema},public`,
  });

  t.after(async () => {
    await pool.end();
    await admin.query(`drop schema ${schema} cascade`);
    await admin.end();
  });

  return {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    transaction: async (work) => runTransaction(await pool.connect(), (query) => work({
      query: async (sql, params) => ({ rows: await query(sql, params) }),
    })),
  };
}
