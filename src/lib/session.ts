import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { generateToken, hashToken, sessionExpiry } from "@/lib/tokens";

export const SESSION_COOKIE = "taskflow_session";
const SESSION_DAYS = 30;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // refresh at most once per hour

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  jobTitle: string | null;
  themePreference: string;
  createdAt: Date;
};

/** Create a DB-backed session and set the httpOnly cookie. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = generateToken();
  const expiresAt = sessionExpiry(new Date(), SESSION_DAYS);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 250) ?? null,
    ipAddress: meta.ipAddress ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolve the signed-in user from the session cookie.
 * Cached per request so multiple server components share one query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        jobTitle: users.jobTitle,
        themePreference: users.themePreference,
        createdAt: users.createdAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Expired or revoked. Cookies cannot be mutated while rendering a server
    // component, so we simply report "no user" — the middleware/pages redirect
    // to /login and the stale cookie is cleared on the next logout or login.
    return null;
  }

  if (Date.now() - row.lastUsedAt.getTime() > REFRESH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastUsedAt: new Date(), expiresAt: sessionExpiry(new Date(), SESSION_DAYS) })
      .where(eq(sessions.id, row.sessionId));
  }

  return row.user;
});

/** Delete the current session (logout) and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  store.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (used after a password change/reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
