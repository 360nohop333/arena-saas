import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration — migrations, push and studio.
 *
 * `npm run db:migrate` applies everything in ./drizzle to the database at
 * DATABASE_URL. Migrations are plain SQL, so they can also be applied by any
 * external tool (psql, turso, a CI step).
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  strict: true,
  verbose: true,
});
