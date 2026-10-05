import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { invites, memberships, projectMembers, projects, tasks, users } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { canManageMember } from "@/lib/permissions";
import { generateToken, inviteExpiry } from "@/lib/tokens";
import { inviteSchema, updateMemberRoleSchema, type ActionResult } from "@/lib/validation";
import {
  adminContextOrFail,
  contextOrFail,
  fail,
  handleError,
  ok,
  parseInput,
  record,
} from "@/server/action-utils";
import type { Role } from "@/lib/constants";

export type TeamData = {
  members: {
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    role: Role;
    title: string | null;
    avatarColor: string;
    joinedAt: Date;
    openTasks: number;
    doneTasks: number;
  }[];
  pendingInvites: {
    id: string;
    email: string;
    role: Role;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    invitedBy: string | null;
    acceptUrl: string;
  }[];
};

/** Member list + pending invitations, with per-member task load. */
export async function getTeamData(): Promise<ActionResult<TeamData>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    const memberRows = await db
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
      .where(eq(memberships.workspaceId, ctx.workspace.id));

    const taskRows = memberRows.length
      ? await db
          .select({ assigneeId: tasks.assigneeId, status: tasks.status })
          .from(tasks)
          .where(
            and(
              eq(tasks.workspaceId, ctx.workspace.id),
              inArray(
                tasks.assigneeId,
                memberRows.map((row) => row.userId),
              ),
            ),
          )
      : [];

    const rank: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

    const members = memberRows
      .map((row) => ({
        membershipId: row.membershipId,
        userId: row.userId,
        name: row.name,
        email: row.email,
        role: row.role as Role,
        title: row.title ?? row.jobTitle,
        avatarColor: row.avatarColor,
        joinedAt: row.joinedAt,
        openTasks: taskRows.filter((task) => task.assigneeId === row.userId && task.status !== "DONE")
          .length,
        doneTasks: taskRows.filter((task) => task.assigneeId === row.userId && task.status === "DONE")
          .length,
      }))
      .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));

    const inviteRows = await db
      .select({
        id: invites.id,
        email: invites.email,
        role: invites.role,
        token: invites.token,
        expiresAt: invites.expiresAt,
        createdAt: invites.createdAt,
        invitedBy: users.name,
      })
      .from(invites)
      .leftJoin(users, eq(invites.invitedById, users.id))
      .where(and(eq(invites.workspaceId, ctx.workspace.id), eq(invites.status, "PENDING")));

    const baseUrl = serverEnv().APP_URL.replace(/\/$/, "");

    return ok({
      members,
      pendingInvites: inviteRows
        .map((row) => ({
          ...row,
          role: row.role as Role,
          acceptUrl: `${baseUrl}/invite/${row.token}`,
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    });
  } catch (error) {
    return handleError(error, "Could not load team members.");
  }
}

/**
 * Invite a teammate.
 *
 * If the email already belongs to a TaskFlow user the invitation is stored and
 * shown in the UI with a copyable accept link. Sending email is left to a
 * pluggable mailer (see README) — the token is the single source of truth.
 */
export async function inviteMemberCommand(
  input: unknown,
): Promise<ActionResult<{ inviteId: string; acceptUrl: string; existingUser: boolean }>> {
  const parsed = parseInput(inviteSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const { email, role } = parsed.data;

  try {
    const [existingUser] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      const [existingMembership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.userId, existingUser.id)),
        )
        .limit(1);

      if (existingMembership) {
        return fail("That person is already a member of this workspace.", "CONFLICT", {
          email: ["Already a member"],
        });
      }
    }

    // Replace any previous pending invitation for the same address.
    await db
      .delete(invites)
      .where(
        and(
          eq(invites.workspaceId, ctx.workspace.id),
          eq(invites.email, email),
          eq(invites.status, "PENDING"),
        ),
      );

    const token = generateToken();
    const [invite] = await db
      .insert(invites)
      .values({
        workspaceId: ctx.workspace.id,
        email,
        role,
        token,
        invitedById: ctx.user.id,
        expiresAt: inviteExpiry(new Date(), 14),
      })
      .returning();

    await record(ctx, "member.invited", `invited ${email} as ${role.toLowerCase()}`, {
      metadata: { email, role },
    });

    const acceptUrl = `${serverEnv().APP_URL.replace(/\/$/, "")}/invite/${token}`;
    console.info(`[taskflow] invitation for ${email}: ${acceptUrl}`);

    return ok(
      { inviteId: invite.id, acceptUrl, existingUser: Boolean(existingUser) },
      existingUser
        ? `Invitation ready for ${email}. Share the accept link below.`
        : `Invitation created. ${email} needs to sign up with that email, then can use the link.`,
    );
  } catch (error) {
    return handleError(error, "Could not create the invitation.");
  }
}

export async function revokeInviteCommand(input: {
  inviteId: string;
}): Promise<ActionResult<{ inviteId: string }>> {
  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const inviteId = String(input?.inviteId ?? "");

  try {
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!invite) return fail("Invitation not found.", "NOT_FOUND");

    await db.update(invites).set({ status: "REVOKED" }).where(eq(invites.id, inviteId));

    return ok({ inviteId }, `Invitation for ${invite.email} revoked.`);
  } catch (error) {
    return handleError(error, "Could not revoke the invitation.");
  }
}

export async function changeMemberRoleCommand(
  input: unknown,
): Promise<ActionResult<{ membershipId: string; role: Role }>> {
  const parsed = parseInput(updateMemberRoleSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const { memberId, role } = parsed.data;

  try {
    const [target] = await db
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        userId: users.id,
        name: users.name,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.id, memberId), eq(memberships.workspaceId, ctx.workspace.id)))
      .limit(1);

    if (!target) return fail("Member not found.", "NOT_FOUND");
    if (!canManageMember(ctx.role, target.role)) {
      return fail("You cannot change that member's role.", "FORBIDDEN");
    }

    await db.update(memberships).set({ role }).where(eq(memberships.id, memberId));

    await record(
      ctx,
      "member.role_changed",
      `changed ${target.name}'s role to ${role.toLowerCase()}`,
      { metadata: { userId: target.userId, role } },
    );

    return ok({ membershipId: memberId, role }, `${target.name} is now ${role.toLowerCase()}.`);
  } catch (error) {
    return handleError(error, "Could not change the role.");
  }
}

/** Remove a teammate and clean up their assignments. */
export async function removeMemberCommand(input: {
  memberId: string;
  reassignTo?: string | null;
}): Promise<ActionResult<{ memberId: string }>> {
  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const memberId = String(input?.memberId ?? "");
  const reassignTo = input?.reassignTo ? String(input.reassignTo) : null;

  try {
    const [target] = await db
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        userId: users.id,
        name: users.name,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.id, memberId), eq(memberships.workspaceId, ctx.workspace.id)))
      .limit(1);

    if (!target) return fail("Member not found.", "NOT_FOUND");
    if (!canManageMember(ctx.role, target.role)) {
      return fail("You cannot remove that member.", "FORBIDDEN");
    }
    if (target.userId === ctx.user.id) {
      return fail("You cannot remove yourself from the workspace.", "FORBIDDEN");
    }

    if (reassignTo) {
      const [valid] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, ctx.workspace.id),
            eq(memberships.userId, reassignTo),
            ne(memberships.userId, target.userId),
          ),
        )
        .limit(1);
      if (!valid) return fail("Choose a valid teammate to reassign work to.", "VALIDATION");
    }

    await db.transaction(async (tx) => {
      // Remove their project memberships for this workspace...
      const projectRows = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, ctx.workspace.id));

      if (projectRows.length > 0) {
        await tx.delete(projectMembers).where(
          and(
            eq(projectMembers.userId, target.userId),
            inArray(
              projectMembers.projectId,
              projectRows.map((project) => project.id),
            ),
          ),
        );
      }

      // ...and never leave dangling task assignments behind.
      await tx
        .update(tasks)
        .set({ assigneeId: reassignTo, updatedAt: new Date() })
        .where(and(eq(tasks.workspaceId, ctx.workspace.id), eq(tasks.assigneeId, target.userId)));

      await tx.delete(memberships).where(eq(memberships.id, memberId));
    });

    await record(ctx, "member.removed", `removed ${target.name} from the workspace`, {
      metadata: { userId: target.userId },
    });

    return ok({ memberId }, `${target.name} was removed from the workspace.`);
  } catch (error) {
    return handleError(error, "Could not remove the member.");
  }
}
