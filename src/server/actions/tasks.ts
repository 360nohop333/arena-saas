import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { memberships, projectMembers, projects, tasks } from "@/db/schema";
import type { Priority } from "@/lib/constants";
import {
  prioritySchema,
  taskSchema,
  taskStatusSchema,
  type ActionResult,
} from "@/lib/validation";
import {
  contextOrFail,
  fail,
  handleError,
  ok,
  parseInput,
  record,
} from "@/server/action-utils";

/** Ensure the project belongs to the caller's workspace and return the assignee check. */
async function assertProject(workspaceId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return project ?? null;
}

/** Assignees must be workspace members — never another tenant's user. */
async function validateAssignee(workspaceId: string, assigneeId: string | null): Promise<boolean> {
  if (!assigneeId) return true;
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, assigneeId)))
    .limit(1);
  return Boolean(row);
}

export async function createTaskCommand(
  input: unknown,
): Promise<ActionResult<{ taskId: string; projectId: string }>> {
  const parsed = parseInput(taskSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const data = parsed.data;

  try {
    const project = await assertProject(ctx.workspace.id, data.projectId);
    if (!project) return fail("Project not found in this workspace.", "NOT_FOUND", {
      projectId: ["Choose a project in this workspace"],
    });

    if (!(await validateAssignee(ctx.workspace.id, data.assigneeId ?? null))) {
      return fail("That assignee is not a member of this workspace.", "FORBIDDEN", {
        assigneeId: ["Choose a teammate from this workspace"],
      });
    }

    const [task] = await db
      .insert(tasks)
      .values({
        workspaceId: ctx.workspace.id,
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId ?? null,
        createdById: ctx.user.id,
        completedAt: data.status === "DONE" ? new Date() : null,
      })
      .returning();

    // Creating a task for someone implies they work on the project.
    if (data.assigneeId) {
      await db
        .insert(projectMembers)
        .values({ projectId: data.projectId, userId: data.assigneeId })
        .onConflictDoNothing();
    }

    await record(ctx, "task.created", `created task “${task.title}”`, {
      projectId: data.projectId,
      taskId: task.id,
      metadata: { priority: data.priority, status: data.status },
    });

    return ok({ taskId: task.id, projectId: data.projectId }, "Task created.");
  } catch (error) {
    return handleError(error, "Could not create the task.");
  }
}

/** Create several tasks at once (used by the AI breakdown "add to project"). */
export async function bulkCreateTasksCommand(input: {
  projectId: string;
  tasks: {
    title: string;
    description?: string;
    priority?: string;
    dueInDays?: number | null;
    assigneeId?: string | null;
  }[];
}): Promise<ActionResult<{ created: number; projectId: string }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  const projectId = String(input?.projectId ?? "");
  const rows = Array.isArray(input?.tasks) ? input.tasks.slice(0, 25) : [];
  if (rows.length === 0) return fail("There is nothing to add.", "VALIDATION");

  try {
    const project = await assertProject(ctx.workspace.id, projectId);
    if (!project) return fail("Project not found.", "NOT_FOUND");

    const today = new Date();
    const values = rows
      .map((row) => {
        const title = String(row.title ?? "").trim();
        if (title.length < 2) return null;
        const priority = prioritySchema.safeParse(row.priority).success
          ? (row.priority as Priority)
          : "MEDIUM";
        const dueDate =
          typeof row.dueInDays === "number" && Number.isFinite(row.dueInDays)
            ? new Date(today.getTime() + Math.max(0, Math.min(row.dueInDays, 180)) * 86_400_000)
            : null;
        return {
          workspaceId: ctx.workspace.id,
          projectId,
          title: title.slice(0, 140),
          description: String(row.description ?? "").slice(0, 4000) || null,
          priority,
          status: "TODO" as const,
          dueDate,
          assigneeId: null,
          createdById: ctx.user.id,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    if (values.length === 0) return fail("Those tasks were not valid.", "VALIDATION");

    await db.insert(tasks).values(values);

    await record(
      ctx,
      "task.created",
      `added ${values.length} task${values.length === 1 ? "" : "s"} to “${project.name}” from the AI assistant`,
      { projectId, metadata: { source: "ai", count: values.length } },
    );

    return ok({ created: values.length, projectId }, `${values.length} task(s) added to the project.`);
  } catch (error) {
    return handleError(error, "Could not add the tasks.");
  }
}

export async function updateTaskCommand(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const payload = (input ?? {}) as Record<string, unknown>;
  const taskId = String(payload.id ?? "");
  if (!taskId) return fail("Missing task id.", "VALIDATION");

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ctx.workspace.id)))
      .limit(1);

    if (!existing) return fail("Task not found.", "NOT_FOUND");

    // Validate only the fields that were provided.
    const schema = taskSchema.partial();
    const parsed = parseInput(schema, { ...payload, id: undefined });
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    if (data.projectId && data.projectId !== existing.projectId) {
      const project = await assertProject(ctx.workspace.id, data.projectId);
      if (!project) return fail("Project not found.", "NOT_FOUND", {
        projectId: ["Choose a project in this workspace"],
      });
    }

    if (data.assigneeId !== undefined && !(await validateAssignee(ctx.workspace.id, data.assigneeId ?? null))) {
      return fail("That assignee is not a member of this workspace.", "FORBIDDEN", {
        assigneeId: ["Choose a teammate from this workspace"],
      });
    }

    const nextStatus = (data.status ?? existing.status) as string;
    const becameDone = nextStatus === "DONE" && existing.status !== "DONE";
    const reopened = nextStatus !== "DONE" && existing.status === "DONE";

    await db
      .update(tasks)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId ?? null } : {}),
        ...(becameDone ? { completedAt: new Date() } : {}),
        ...(reopened ? { completedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    if (becameDone) {
      await record(ctx, "task.completed", `completed task “${existing.title}”`, {
        projectId: existing.projectId,
        taskId,
      });
    } else if (reopened) {
      await record(ctx, "task.reopened", `reopened task “${existing.title}”`, {
        projectId: existing.projectId,
        taskId,
      });
    } else {
      await record(ctx, "task.updated", `updated task “${data.title ?? existing.title}”`, {
        projectId: existing.projectId,
        taskId,
      });
    }

    return ok({ taskId }, "Task updated.");
  } catch (error) {
    return handleError(error, "Could not update the task.");
  }
}

/** Quick toggle used by the task list checkbox and the board. */
export async function toggleTaskStatusCommand(input: {
  taskId: string;
  status?: string;
}): Promise<ActionResult<{ taskId: string; status: string }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  const taskId = String(input?.taskId ?? "");
  const requested = input?.status;

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!existing) return fail("Task not found.", "NOT_FOUND");

    const parsedStatus = taskStatusSchema.safeParse(requested);
    const status = parsedStatus.success
      ? parsedStatus.data
      : existing.status === "DONE"
        ? "TODO"
        : "DONE";

    await db
      .update(tasks)
      .set({
        status,
        completedAt: status === "DONE" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await record(
      ctx,
      status === "DONE" ? "task.completed" : "task.updated",
      status === "DONE"
        ? `completed task “${existing.title}”`
        : `moved “${existing.title}” to ${status.replace("_", " ").toLowerCase()}`,
      { projectId: existing.projectId, taskId },
    );

    return ok({ taskId, status }, status === "DONE" ? "Task completed 🎉" : "Task updated.");
  } catch (error) {
    return handleError(error, "Could not update the task.");
  }
}

export async function deleteTaskCommand(input: {
  taskId: string;
}): Promise<ActionResult<{ taskId: string }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const taskId = String(input?.taskId ?? "");

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!existing) return fail("Task not found.", "NOT_FOUND");

    await db.delete(tasks).where(eq(tasks.id, taskId));
    await record(ctx, "task.deleted", `deleted task “${existing.title}”`, {
      projectId: existing.projectId,
      metadata: { title: existing.title },
    });

    return ok({ taskId }, "Task deleted.");
  } catch (error) {
    return handleError(error, "Could not delete the task.");
  }
}

/** Reassign every open task from one member to another (used when removing members). */
export async function reassignTasksCommand(input: {
  fromUserId: string;
  toUserId: string | null;
}): Promise<ActionResult<{ moved: number }>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;

  const fromUserId = String(input?.fromUserId ?? "");
  const toUserId = input?.toUserId ? String(input.toUserId) : null;

  if (toUserId && !(await validateAssignee(ctx.workspace.id, toUserId))) {
    return fail("That teammate is not in this workspace.", "FORBIDDEN");
  }

  try {
    const affected = await db
      .update(tasks)
      .set({ assigneeId: toUserId, updatedAt: new Date() })
      .where(and(eq(tasks.workspaceId, ctx.workspace.id), eq(tasks.assigneeId, fromUserId)))
      .returning({ id: tasks.id });

    return ok({ moved: affected.length }, `${affected.length} task(s) reassigned.`);
  } catch (error) {
    return handleError(error, "Could not reassign tasks.");
  }
}
