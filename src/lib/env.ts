import { z } from "zod";

/**
 * Server-side environment access.
 *
 * This module is only imported from server code (route handlers, server
 * actions, data-access helpers). Values marked "secret" are never forwarded to
 * client components — see `src/lib/ai/provider.ts` for the AI key handling.
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(24, "SESSION_SECRET must be at least 24 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AI_PROVIDER: z.enum(["local", "openai"]).default("local"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  DEMO_EMAIL: z.string().default("demo@taskflow.ai"),
  DEMO_PASSWORD: z.string().default("Demo1234!"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    APP_URL: process.env.APP_URL,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DEMO_EMAIL: process.env.DEMO_EMAIL,
    DEMO_PASSWORD: process.env.DEMO_PASSWORD,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`,
    );
  }

  // An OpenAI-compatible provider without a key silently degrades to the local
  // engine. Warn loudly so misconfiguration is obvious in the logs.
  if (parsed.data.AI_PROVIDER === "openai" && !parsed.data.OPENAI_API_KEY) {
    console.warn(
      "[taskflow] AI_PROVIDER=openai but OPENAI_API_KEY is empty — falling back to the local analysis engine.",
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when a remote LLM is configured and usable. */
export function hasRemoteAi(): boolean {
  try {
    const env = serverEnv();
    return env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY.trim().length > 0;
  } catch {
    return false;
  }
}
