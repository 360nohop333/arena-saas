import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import type { ActionErrorCode, ActionResult } from "@/lib/validation";
import { commands, isCommandName } from "@/server/commands";

/**
 * Typed command endpoint.
 *
 * POST /api/actions/<command>  { ...input }
 * → { ok: true, data, message } | { ok: false, error, code, fieldErrors }
 *
 * • Commands validate every field with Zod.
 * • Workspace-scoped commands resolve the caller from the session cookie, so
 *   data can only ever be read/written inside the caller's own workspace.
 * • Errors are returned as JSON with a meaningful HTTP status; internals are
 *   never leaked to the client.
 */

const STATUS_BY_CODE: Record<ActionErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  if (!isCommandName(name)) {
    return NextResponse.json<ActionResult>(
      { ok: false, error: `Unknown command “${name}”.`, code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "local";

  // Coarse abuse protection in front of every command.
  const limit = rateLimit(`api:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json<ActionResult>(
      { ok: false, error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json<ActionResult>(
        { ok: false, error: "Request body must be valid JSON.", code: "VALIDATION" },
        { status: 422 },
      );
    }
  }

  try {
    const command = commands[name] as (input: unknown) => Promise<ActionResult>;
    const result = await command(payload);

    if (result.ok) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result, {
      status: STATUS_BY_CODE[result.code ?? "INTERNAL"] ?? 500,
    });
  } catch (error) {
    console.error(`[taskflow] command ${name} threw:`, error);
    return NextResponse.json<ActionResult>(
      { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
