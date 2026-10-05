import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";
import { serverEnv } from "@/lib/env";

/**
 * Database client singleton.
 *
 * NOTE: deliberately does not import "server-only" so the seed/CLI scripts can
 * share this exact client. Every app-level consumer (queries, commands,
 * sessions) does declare "server-only", which keeps the driver out of the
 * client bundle.
 *
 * `DATABASE_URL` accepts:
 *   • file:./dev.db            → local SQLite file (default, zero setup)
 *   • libsql://<db>.turso.io   → Turso (set DATABASE_AUTH_TOKEN)
 *   • http(s)://...            → any libSQL server
 *
 * The client is cached on `globalThis` so Next.js hot reloads do not leak
 * connections in development.
 */

export type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __taskflowClient?: Client;
  __taskflowDb?: Database;
};

function createDatabase() {
  const env = serverEnv();
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return { client, db: drizzle(client, { schema }) };
}

const created = globalForDb.__taskflowDb
  ? { client: globalForDb.__taskflowClient as Client, db: globalForDb.__taskflowDb }
  : createDatabase();

export const db: Database = created.db;
export const rawClient: Client = created.client;
export { schema };

if (process.env.NODE_ENV !== "production") {
  globalForDb.__taskflowDb = db;
  globalForDb.__taskflowClient = rawClient;
}

/**
 * Run a set of statements in a single transaction.
 * SQLite/libSQL transactions are serialised, which keeps multi-table writes
 * (e.g. seeding, project creation) atomic.
 */
export function transaction<T>(fn: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>) {
  return db.transaction(fn);
}
