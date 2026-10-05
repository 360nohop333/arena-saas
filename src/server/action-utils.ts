import "server-only";

import { z } from "zod";

import { logActivity, type ActivityType } from "@/lib/activity";
import type { Role } from "@/lib/constants";
import { canManageWorkspace } from "@/lib/permissions";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/workspace";
import type { ActionErrorCode, ActionResult, FieldErrors } from "@/lib/validation";
import { toFieldErrors } from "@/lib/validation";

/**
 * Shared plumbing for the server commands in `src/server/actions/**`.
 *
 * Every command returns a discriminated `ActionResult` so it can be consumed by
 * a Server Action *or* by a JSON route handler without changing the logic.
 */

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  code: ActionErrorCode = "INTERNAL",
  fieldErrors?: FieldErrors,
): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}

/** Parse input with a Zod schema, returning field errors on failure. */
export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      result: fail("Please fix the highlighted fields.", "VALIDATION", toFieldErrors(parsed.error)),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Signed-in user + active workspace, or an UNAUTHORIZED result. */
export async function contextOrFail(): Promise<
  { ok: true; ctx: WorkspaceContext } | { ok: false; result: ActionResult<never> }
> {
  const ctx = await resolveWorkspaceContext();
  if (!ctx) {
    return { ok: false, result: fail("You must be signed in to do that.", "UNAUTHORIZED") };
  }
  return { ok: true, ctx };
}

/** As above, but requires an admin/owner role in the workspace. */
export async function adminContextOrFail(): Promise<
  { ok: true; ctx: WorkspaceContext } | { ok: false; result: ActionResult<never> }
> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved;
  if (!canManageWorkspace(resolved.ctx.role)) {
    return { ok: false, result: fail("Only workspace owners and admins can do that.", "FORBIDDEN") };
  }
  return resolved;
}

export function hasRole(ctx: WorkspaceContext, ...roles: Role[]): boolean {
  return roles.includes(ctx.role);
}

/** Record an activity entry for the active workspace. */
export async function record(
  ctx: WorkspaceContext,
  type: ActivityType,
  message: string,
  extra: { projectId?: string | null; taskId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    type,
    message,
    ...extra,
  });
}

/**
 * Turn an unexpected exception into a consistent, non-leaky error result.
 * Unique-constraint violations surface as CONFLICT with a friendly message.
 */
export function handleError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): ActionResult<never> {
  const message = error instanceof Error ? error.message : String(error);

  if (/UNIQUE constraint failed|SQLITE_CONSTRAINT|is unique/i.test(message)) {
    return fail("That record already exists.", "CONFLICT");
  }
  if (/foreign key/i.test(message)) {
    return fail("A related record is missing.", "CONFLICT");
  }

  console.error("[taskflow] command failed:", error);
  return fail(fallback, "INTERNAL");
}
