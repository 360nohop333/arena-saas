import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { memberships, sessions, users, workspaces } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashToken, sessionExpiry } from "@/lib/tokens";
import { revokeAllSessions, SESSION_COOKIE } from "@/lib/session";
import type { ThemePreference } from "@/lib/constants";
import {
  changePasswordSchema,
  notificationSchema,
  profileSchema,
  themeSchema,
  workspaceSchema,
  type ActionResult,
} from "@/lib/validation";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import {
  adminContextOrFail,
  contextOrFail,
  fail,
  handleError,
  ok,
  parseInput,
  record,
} from "@/server/action-utils";

export type SettingsData = {
  profile: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
    timezone: string;
    avatarColor: string;
    createdAt: Date;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    weeklyDigest: boolean;
    dueDateReminders: boolean;
  };
  theme: ThemePreference;
  workspace: { id: string; name: string; slug: string; plan: string; role: string };
};

export async function getSettingsData(): Promise<ActionResult<SettingsData>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) return fail("Account not found.", "NOT_FOUND");

    return ok({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        timezone: user.timezone,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
      },
      notifications: {
        emailNotifications: user.emailNotifications,
        pushNotifications: user.pushNotifications,
        weeklyDigest: user.weeklyDigest,
        dueDateReminders: user.dueDateReminders,
      },
      theme: user.themePreference as ThemePreference,
      workspace: {
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
        plan: ctx.workspace.plan,
        role: ctx.role,
      },
    });
  } catch (error) {
    return handleError(error, "Could not load your settings.");
  }
}

export async function updateProfileCommand(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(profileSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const data = parsed.data;

  try {
    if (data.email !== ctx.user.email) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, data.email), ne(users.id, ctx.user.id)))
        .limit(1);
      if (taken) {
        return fail("That email is already in use.", "CONFLICT", {
          email: ["That email is already in use"],
        });
      }
    }

    await db
      .update(users)
      .set({
        name: data.name,
        email: data.email,
        jobTitle: data.jobTitle || null,
        timezone: data.timezone || "UTC",
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    return ok(undefined, "Profile updated.");
  } catch (error) {
    return handleError(error, "Could not update your profile.");
  }
}

export async function changePasswordCommand(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(changePasswordSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) return fail("Account not found.", "NOT_FOUND");

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return fail("Your current password is incorrect.", "VALIDATION", {
        currentPassword: ["Your current password is incorrect"],
      });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));

    // Keep the current session alive, drop every other device.
    const store = await cookies();
    const currentToken = store.get(SESSION_COOKIE)?.value;
    await revokeAllSessions(ctx.user.id);

    if (currentToken) {
      await db.insert(sessions).values({
        tokenHash: hashToken(currentToken),
        userId: ctx.user.id,
        expiresAt: sessionExpiry(new Date(), 30),
      });
    }

    return ok(undefined, "Password changed. Other devices were signed out.");
  } catch (error) {
    return handleError(error, "Could not change your password.");
  }
}

export async function updateNotificationsCommand(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(notificationSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    await db
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id));
    return ok(undefined, "Notification preferences saved.");
  } catch (error) {
    return handleError(error, "Could not save your preferences.");
  }
}

/** Theme lives on the user record so it follows them across devices. */
export async function updateThemeCommand(input: unknown): Promise<ActionResult<{ theme: ThemePreference }>> {
  const parsed = parseInput(themeSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;

  try {
    await db
      .update(users)
      .set({ themePreference: parsed.data.theme, updatedAt: new Date() })
      .where(eq(users.id, resolved.ctx.user.id));
    return ok({ theme: parsed.data.theme }, "Theme updated.");
  } catch (error) {
    return handleError(error, "Could not save the theme.");
  }
}

export async function updateWorkspaceCommand(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(workspaceSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    await db
      .update(workspaces)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(workspaces.id, ctx.workspace.id));

    await record(ctx, "workspace.updated", `renamed the workspace to “${parsed.data.name}”`);

    return ok(undefined, "Workspace updated.");
  } catch (error) {
    return handleError(error, "Could not update the workspace.");
  }
}

/** Switch the active workspace (persisted in a cookie). */
export async function switchWorkspaceCommand(input: {
  workspaceId: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const workspaceId = String(input?.workspaceId ?? "");

  try {
    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, ctx.user.id)))
      .limit(1);

    if (!membership) return fail("You are not a member of that workspace.", "FORBIDDEN");

    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return ok({ workspaceId }, "Workspace switched.");
  } catch (error) {
    return handleError(error, "Could not switch workspaces.");
  }
}

export async function createWorkspaceCommand(input: {
  name: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  const name = String(input?.name ?? "").trim();
  if (name.length < 2) {
    return fail("Workspace name must be at least 2 characters.", "VALIDATION", {
      name: ["Workspace name must be at least 2 characters"],
    });
  }

  try {
    const slugBase =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "workspace";

    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const workspaceId = await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name, slug, ownerId: ctx.user.id })
        .returning();
      await tx
        .insert(memberships)
        .values({ workspaceId: workspace.id, userId: ctx.user.id, role: "OWNER" });
      return workspace.id;
    });

    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return ok({ workspaceId }, `Workspace “${name}” created.`);
  } catch (error) {
    return handleError(error, "Could not create the workspace.");
  }
}
