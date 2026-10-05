import "server-only";

import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { memberships, users, workspaces } from "@/db/schema";
import type { Role } from "@/lib/constants";
import { canManageWorkspace } from "@/lib/permissions";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { slugify } from "@/lib/utils";

export const ACTIVE_WORKSPACE_COOKIE = "taskflow_workspace";

export type MemberSummary = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  avatarColor: string;
  joinedAt: Date;
};

export type WorkspaceContext = {
  user: SessionUser;
  workspace: { id: string; name: string; slug: string; plan: string; createdAt: Date };
  role: Role;
  membershipId: string;
  members: MemberSummary[];
};

/** Redirect to the login page when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function listMembers(workspaceId: string): Promise<MemberSummary[]> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      title: memberships.title,
      jobTitle: users.jobTitle,
      avatarColor: users.avatarColor,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(asc(memberships.joinedAt));

  const rank: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

  return rows
    .map((row) => ({
      membershipId: row.membershipId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      title: row.title ?? row.jobTitle,
      avatarColor: row.avatarColor,
      joinedAt: row.joinedAt,
    }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}

/**
 * Resolve the active workspace for the signed-in user together with their role
 * and the member list. Every workspace-scoped read/write goes through this, so
 * access control is enforced in exactly one place.
 *
 * Returns `null` instead of redirecting so it can also be used from JSON API
 * route handlers.
 */
export const resolveWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await cookies();
  const preferredId = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  const rows = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        plan: workspaces.plan,
        createdAt: workspaces.createdAt,
      },
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, user.id))
    .orderBy(asc(memberships.joinedAt));

  // A user always has a workspace (created at signup). Recover gracefully if the
  // data was modified externally, so the app never dead-ends.
  if (rows.length === 0) {
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: `${user.name.split(" ")[0]}'s Workspace`,
        slug: `${slugify(user.name)}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: user.id,
      })
      .returning();

    const [membership] = await db
      .insert(memberships)
      .values({ workspaceId: workspace.id, userId: user.id, role: "OWNER" })
      .returning();

    return {
      user,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        createdAt: workspace.createdAt,
      },
      role: "OWNER",
      membershipId: membership.id,
      members: await listMembers(workspace.id),
    };
  }

  const active = rows.find((row) => row.workspace.id === preferredId) ?? rows[0];

  return {
    user,
    workspace: active.workspace,
    role: active.role as Role,
    membershipId: active.membershipId,
    members: await listMembers(active.workspace.id),
  };
});

/** Page-level guard: redirects anonymous visitors to the login screen. */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const context = await resolveWorkspaceContext();
  if (!context) redirect("/login");
  return context;
}

/** Guard for pages/actions that require elevated workspace permissions. */
export async function requireAdmin(): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!canManageWorkspace(context.role)) redirect("/dashboard?error=forbidden");
  return context;
}

/** Workspaces the user can switch between, for the sidebar switcher. */
export const getUserWorkspaces = cache(
  async (): Promise<{ id: string; name: string; role: Role }[]> => {
    const user = await getCurrentUser();
    if (!user) return [];

    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.joinedAt));

    return rows.map((row) => ({ id: row.id, name: row.name, role: row.role as Role }));
  },
);
