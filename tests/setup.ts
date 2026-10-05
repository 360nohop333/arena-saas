/**
 * Test bootstrap: loads `.env` so modules that validate the environment
 * (src/lib/env.ts) behave exactly as they do at runtime.
 */
import "dotenv/config";

// NODE_ENV is typed as read-only on ProcessEnv, hence the cast.
const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = env.NODE_ENV ?? "test";
env.SESSION_SECRET = env.SESSION_SECRET ?? "test-secret-value-with-enough-length";
env.DATABASE_URL = env.DATABASE_URL ?? "file:./dev.db";
