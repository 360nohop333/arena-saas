import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiRuns, projectMembers, projects, tasks, users } from "@/db/schema";
import { loadAiPanel, type AiPanelData } from "@/server/ai-panel";
import { generateAiResponse } from "@/lib/ai/provider";
import type { AiActivity, AiProject, AiTask } from "@/lib/ai/engine";
import { rateLimit } from "@/lib/rate-limit";
import { aiRequestSchema, type ActionResult } from "@/lib/validation";
import type { AiResponse } from "@/lib/ai/engine";
import {
  contextOrFail,
  fail,
  handleError,
  ok,
  parseInput,
  record,
} from "@/server/action-utils";

/** Everything the assistant panel needs on first paint / refresh. */
export async function getAiPanelData(projectId: string): Promise<ActionResult<AiPanelData>> {
  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;

  try {
    const data = await loadAiPanel(resolved.ctx.workspace.id, projectId, resolved.ctx.user.id);
    return ok(data);
  } catch (error) {
    return handleError(error, "Could not load the assistant.");
  }
}

/**
 * Run an assistant analysis against a project.
 *
 * • Access is scoped to the caller's workspace.
 * • Rate limited per user.
 * • Results are persisted so history survives reloads.
 */
export async function runAssistantCommand(
  input: unknown,
): Promise<ActionResult<{ result: AiResponse }>> {
  const parsed = parseInput(aiRequestSchema, input);
  if (!parsed.ok) return parsed.result;

  const resolved = await contextOrFail();
  if (!resolved.ok) return resolved.result;
  const { ctx } = resolved;
  const { projectId, kind, prompt } = parsed.data;

  const limit = rateLimit(`ai:${ctx.user.id}`, 20, 60_000);
  if (!limit.ok) {
    return fail(
      `The assistant is cooling down. Try again in ${limit.retryAfterSeconds}s.`,
      "RATE_LIMITED",
    );
  }

  try {
    const context = await loadProjectContext(ctx.workspace.id, projectId);
    if (!context) return fail("Project not found.", "NOT_FOUND");

    const result = await generateAiResponse({
      kind,
      project: context.project,
      prompt,
      activity: context.activity,
    });

    await db.insert(aiRuns).values({
      workspaceId: ctx.workspace.id,
      projectId,
      kind,
      prompt: prompt.slice(0, 2000),
      output: JSON.stringify(result),
      provider: result.provider,
      createdById: ctx.user.id,
    });

    await record(ctx, "ai.generated", `ran the AI assistant (${kind}) on “${context.project.name}”`, {
      projectId,
      metadata: { kind, provider: result.provider },
    });

    return ok({ result });
  } catch (error) {
    return handleError(error, "The assistant could not complete that request.");
  }
}

/** Build the structured context the engine/LLM analyses. */
async function loadProjectContext(workspaceId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);

  if (!project) return null;

  const [taskRows, memberRows, activityRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(eq(tasks.projectId, projectId)),
    db
      .select({ userId: projectMembers.userId, name: users.name })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId)),
    db
      .select({ message: tasks.title, createdAt: tasks.updatedAt })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.updatedAt))
      .limit(5),
  ]);

  const aiProject: AiProject = {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    deadline: project.deadline,
    createdAt: project.createdAt,
    memberNames: memberRows.map((row) => row.name),
    tasks: taskRows.map<AiTask>((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
    })),
  };

  const activity: AiActivity[] = activityRows.map((row) => ({
    message: `updated “${row.message}”`,
    createdAt: row.createdAt,
  }));

  return { project: aiProject, activity };
}
