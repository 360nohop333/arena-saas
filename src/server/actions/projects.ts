import "server-only";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { memberships, projectMembers, projects, tasks, users } from "@/db/schema";
import type { ProjectStatus } from "@/lib/constants";
import { canDeleteProject } from "@/lib/permissions";
import { projectSchema, type ActionResult } from "@/lib/validation";
import {
  adminContextOrFail,
  contextOrFail,
  fail,
  handleError,
  ok,
  parseInput,
  record,
} from "@/server/action-utils";

function projectIdInput(value: unknown): string {
  if (typeof value === "object" && value !== null && "projectId" in value) {
    return String((value as { projectId: unknown }).projectId ?? "");
  }
  return "";
}

/** Verify the project belongs to the caller's workspace. */
async function findProject(ctx: { workspace: { id: string } }, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspace.id)))
    .limit(1);
  return project ?? null;
}

export async function createProjectCommand(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  const parsed = parseInput(projectSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const data = parsed.data;

  try {
    const validMemberIds = await filterWorkspaceMembers(ctx.workspace.id, data.memberIds ?? []);
    // The creator is always a project member.
    const memberIds = [...new Set([ctx.user.id, ...validMemberIds])];

    const projectId = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          workspaceId: ctx.workspace.id,
          name: data.name,
          description: data.description || null,
          status: data.status,
          deadline: data.deadline,
          color: data.color,
          ownerId: ctx.user.id,
        })
        .returning();

      await tx
        .insert(projectMembers)
        .values(memberIds.map((userId) => ({ projectId: project.id, userId })));

      return project.id;
    });

    await record(ctx, "project.created", `created project “${data.name}”`, {
      projectId,
      metadata: { status: data.status },
    });

    return ok({ projectId }, `Project “${data.name}” created.`);
  } catch (error) {
    return handleError(error, "Could not create the project.");
  }
}

export async function updateProjectCommand(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  const projectId = projectIdInput(input);
  const parsed = parseInput(projectSchema.partial(), input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    const project = await findProject(ctx, projectId);
    if (!project) return fail("Project not found.", "NOT_FOUND");

    const data = parsed.data;
    const memberIds = data.memberIds
      ? await filterWorkspaceMembers(ctx.workspace.id, data.memberIds)
      : undefined;

    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      if (memberIds) {
        const keepIds = [...new Set([ctx.user.id, ...memberIds])];
        await tx
          .delete(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, projectId),
              notInArray(projectMembers.userId, keepIds),
            ),
          );
        for (const userId of keepIds) {
          await tx.insert(projectMembers).values({ projectId, userId }).onConflictDoNothing();
        }
      }
    });

    const statusChanged = Boolean(data.status && data.status !== project.status);
    await record(
      ctx,
      "project.updated",
      statusChanged
        ? `moved “${project.name}” to ${String(data.status).replace("_", " ").toLowerCase()}`
        : `updated project “${project.name}”`,
      { projectId },
    );

    return ok({ projectId }, `Project “${data.name ?? project.name}” updated.`);
  } catch (error) {
    return handleError(error, "Could not update the project.");
  }
}

/** Archive (soft) or restore a project. Archiving hides it from active views. */
export async function setProjectArchivedCommand(input: {
  projectId: string;
  archived: boolean;
}): Promise<ActionResult<{ projectId: string; status: ProjectStatus }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const projectId = String(input?.projectId ?? "");
  const archived = Boolean(input?.archived);

  try {
    const project = await findProject(ctx, projectId);
    if (!project) return fail("Project not found.", "NOT_FOUND");

    const previousStatus = project.status as ProjectStatus;
    const status: ProjectStatus = archived
      ? "ARCHIVED"
      : previousStatus === "ARCHIVED"
        ? "ACTIVE"
        : previousStatus;

    await db
      .update(projects)
      .set({ status, archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await record(
      ctx,
      archived ? "project.archived" : "project.restored",
      `${archived ? "archived" : "restored"} project “${project.name}”`,
      { projectId },
    );

    return ok({ projectId, status }, `Project ${archived ? "archived" : "restored"}.`);
  } catch (error) {
    return handleError(error, "Could not update the project.");
  }
}

export async function deleteProjectCommand(input: {
  projectId: string;
}): Promise<ActionResult<{ projectId: string }>> {
  const resolved = await adminContextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const projectId = String(input?.projectId ?? "");

  if (!canDeleteProject(ctx.role)) {
    return fail("Only workspace owners and admins can delete projects.", "FORBIDDEN");
  }

  try {
    const project = await findProject(ctx, projectId);
    if (!project) return fail("Project not found.", "NOT_FOUND");

    // Cascades remove tasks, project members and project-scoped activity.
    await db.delete(projects).where(eq(projects.id, projectId));

    await record(ctx, "project.deleted", `deleted project “${project.name}”`, {
      metadata: { projectName: project.name },
    });

    return ok({ projectId }, `Project “${project.name}” deleted.`);
  } catch (error) {
    return handleError(error, "Could not delete the project.");
  }
}

/** Add or remove a single project member. */
export async function setProjectMemberCommand(input: {
  projectId: string;
  userId: string;
  member: boolean;
}): Promise<ActionResult<{ projectId: string; userId: string; member: boolean }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  const projectId = String(input?.projectId ?? "");
  const userId = String(input?.userId ?? "");
  const shouldBeMember = Boolean(input?.member);

  try {
    const project = await findProject(ctx, projectId);
    if (!project) return fail("Project not found.", "NOT_FOUND");

    const validIds = await filterWorkspaceMembers(ctx.workspace.id, [userId]);
    if (validIds.length === 0) return fail("That person is not in this workspace.", "FORBIDDEN");

    const [target] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);

    if (shouldBeMember) {
      await db.insert(projectMembers).values({ projectId, userId }).onConflictDoNothing();
    } else {
      await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
      // Unassign their open tasks so nothing is silently orphaned.
      await db
        .update(tasks)
        .set({ assigneeId: null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.assigneeId, userId),
          ),
        );
    }

    await record(
      ctx,
      "project.updated",
      `${shouldBeMember ? "added" : "removed"} ${target?.name ?? "a teammate"} ${
        shouldBeMember ? "to" : "from"
      } “${project.name}”`,
      { projectId },
    );

    return ok({ projectId, userId, member: shouldBeMember });
  } catch (error) {
    return handleError(error, "Could not update project members.");
  }
}

/** Keep only ids that are real members of this workspace. */
async function filterWorkspaceMembers(workspaceId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), inArray(memberships.userId, ids)));
  return rows.map((row) => row.userId);
}

