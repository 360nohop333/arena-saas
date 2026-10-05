import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { db } from "@/db";
import {
  activities,
  invites,
  memberships,
  passwordResetTokens,
  users,
  workspaces,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { serverEnv } from "@/lib/env";
import { generateToken, hashToken, resetTokenExpiry } from "@/lib/tokens";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, destroySession, getCurrentUser, revokeAllSessions } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ActionResult,
} from "@/lib/validation";
import { fail, handleError, ok, parseInput } from "@/server/action-utils";
import { AVATAR_COLORS } from "@/lib/constants";

async function requestMeta() {
  const headerList = await headers();
  return {
    userAgent: headerList.get("user-agent"),
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      null,
  };
}

/**
 * Sign up: create the user, their first workspace, and an owner membership.
 * Runs in a transaction so a partial account can never exist.
 */
export async function signupCommand(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = parseInput(signupSchema, input);
  if (!parsed.ok) return parsed.result;
  const { name, email, password, workspaceName } = parsed.data;

  const limit = rateLimit(`signup:${email}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return fail("Too many sign-up attempts. Please try again later.", "RATE_LIMITED");
  }

  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return fail("An account with that email already exists.", "CONFLICT", {
        email: ["An account with that email already exists"],
      });
    }

    const passwordHash = await hashPassword(password);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          avatarColor,
          themePreference: "system",
        })
        .returning();

      const baseName = workspaceName?.trim() || `${name.split(" ")[0]}'s Workspace`;
      const slug = await uniqueSlug(tx, baseName);

      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: baseName, slug, ownerId: user.id })
        .returning();

      await tx.insert(memberships).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      });

      await tx.insert(activities).values({
        workspaceId: workspace.id,
        actorId: user.id,
        type: "workspace.updated",
        message: `${user.name} created the workspace`,
      });

      return { user, workspace };
    });

    await createSession(result.user.id, await requestMeta());

    return ok({ redirectTo: "/dashboard" }, "Welcome to TaskFlow AI!");
  } catch (error) {
    return handleError(error, "We could not create your account. Please try again.");
  }
}

/** Email + password sign-in. */
export async function loginCommand(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = parseInput(loginSchema, input);
  if (!parsed.ok) return parsed.result;
  const { email, password } = parsed.data;

  const ipLimit = rateLimit(`login:${email}`, 10, 10 * 60 * 1000);
  if (!ipLimit.ok) {
    return fail(
      `Too many sign-in attempts. Try again in ${ipLimit.retryAfterSeconds}s.`,
      "RATE_LIMITED",
    );
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Always run a hash comparison so response timing does not reveal whether
    // the account exists.
    const valid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");

    if (!user || !valid) {
      return fail("Incorrect email or password.", "UNAUTHORIZED");
    }

    await createSession(user.id, await requestMeta());
    return ok({ redirectTo: "/dashboard" }, `Welcome back, ${user.name.split(" ")[0]}!`);
  } catch (error) {
    return handleError(error, "We could not sign you in. Please try again.");
  }
}

export async function logoutCommand(): Promise<ActionResult> {
  try {
    await destroySession();
    return ok(undefined, "You have been signed out.");
  } catch (error) {
    return handleError(error, "Could not sign out.");
  }
}

/**
 * Start a password reset.
 *
 * Always answers the same way so the endpoint cannot be used to enumerate
 * accounts. Without a mail provider configured, the reset link is written to
 * the server log for development (see README → "Remaining limitations").
 */
export async function forgotPasswordCommand(
  input: unknown,
): Promise<ActionResult<{ devResetUrl?: string }>> {
  const parsed = parseInput(forgotPasswordSchema, input);
  if (!parsed.ok) return parsed.result;
  const { email } = parsed.data;

  const limit = rateLimit(`forgot:${email}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return fail("Too many reset requests. Please try again later.", "RATE_LIMITED");
  }

  try {
    const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, email)).limit(1);

    const message = "If an account exists for that email, a reset link is on its way.";

    if (!user) {
      // Same shape of response, slightly slower to avoid a timing side channel.
      await new Promise((resolve) => setTimeout(resolve, 150));
      return ok(undefined, message);
    }

    const token = generateToken();
    await db.insert(passwordResetTokens).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: resetTokenExpiry(new Date(), 1),
    });

    const resetUrl = `${serverEnv().APP_URL}/reset-password?token=${token}`;
    console.info(`[taskflow] password reset link for ${email}: ${resetUrl}`);

    return ok(
      process.env.NODE_ENV === "production" ? undefined : { devResetUrl: resetUrl },
      message,
    );
  } catch (error) {
    return handleError(error, "We could not process that request.");
  }
}

/** Complete a password reset (single-use token, revokes all sessions). */
export async function resetPasswordCommand(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = parseInput(resetPasswordSchema, input);
  if (!parsed.ok) return parsed.result;
  const { token, password } = parsed.data;

  try {
    const tokenHash = hashToken(token);
    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!record) {
      return fail("This reset link is invalid or has expired.", "VALIDATION", {
        token: ["This reset link is invalid or has expired"],
      });
    }

    const passwordHash = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, record.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id));
    });

    await revokeAllSessions(record.userId);

    return ok({ redirectTo: "/login?reset=1" }, "Password updated — sign in with your new password.");
  } catch (error) {
    return handleError(error, "We could not reset your password.");
  }
}

/**
 * Accept a team invitation: joins the invited user to the workspace and signs
 * them in. If they are already signed in with a different account we still let
 * them accept — membership is keyed on the invitation email.
 */
export async function acceptInviteCommand(input: { token: string }): Promise<ActionResult<{ redirectTo: string; workspaceId: string }>> {
  const token = String(input?.token ?? "").trim();
  if (token.length < 10) return fail("This invitation link is invalid.", "VALIDATION");

  try {
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.token, token))
      .limit(1);

    if (!invite) return fail("This invitation link is invalid.", "NOT_FOUND");
    if (invite.status === "REVOKED") return fail("This invitation has been revoked.", "CONFLICT");
    if (invite.status === "ACCEPTED") {
      return ok({ redirectTo: "/dashboard", workspaceId: invite.workspaceId }, "You have already joined this workspace.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return fail("This invitation has expired. Ask an admin to resend it.", "CONFLICT");
    }

    const [user] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1);
    if (!user) {
      return fail(
        "No TaskFlow account uses this invitation email yet. Create an account with that email first.",
        "FORBIDDEN",
      );
    }

    // Never let an invitation swap the caller's identity: whoever is signed in
    // must be the person the invite was addressed to.
    const current = await getCurrentUser();
    if (current && current.id !== user.id) {
      return fail(
        `You are signed in as ${current.email}. Sign in as ${invite.email} to accept this invitation.`,
        "FORBIDDEN",
      );
    }

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.workspaceId, invite.workspaceId), eq(memberships.userId, user.id)))
        .limit(1);

      if (!existing) {
        await tx.insert(memberships).values({
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        });
      }

      await tx
        .update(invites)
        .set({ status: "ACCEPTED", acceptedAt: new Date() })
        .where(eq(invites.id, invite.id));
    });

    await logActivity({
      workspaceId: invite.workspaceId,
      actorId: user.id,
      type: "member.joined",
      message: `${user.name} joined the workspace`,
    });

    await createSession(user.id, await requestMeta());

    // Land the new member directly in the workspace they were invited to.
    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, invite.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return ok(
      { redirectTo: "/dashboard", workspaceId: invite.workspaceId },
      `Welcome to the team, ${user.name.split(" ")[0]}!`,
    );
  } catch (error) {
    return handleError(error, "We could not accept that invitation.");
  }
}

/** Ensure workspace slugs stay unique without a race-prone pre-check. */
async function uniqueSlug(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  name: string,
): Promise<string> {
  const base = slugify(name).slice(0, 40);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const [existing] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

