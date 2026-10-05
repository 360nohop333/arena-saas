import "server-only";

import { db } from "@/db";
import { activities } from "@/db/schema";

export type ActivityType =
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.restored"
  | "project.deleted"
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.reopened"
  | "task.deleted"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "workspace.updated"
  | "ai.generated";

export type LogActivityInput = {
  workspaceId: string;
  type: ActivityType;
  message: string;
  actorId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  projectId: string | null;
  projectName: string | null;
  actorName: string | null;
  actorColor: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Append to the workspace audit trail.
 *
 * Activity logging must never break the user-facing mutation, so failures are
 * logged and swallowed.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activities).values({
      workspaceId: input.workspaceId,
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  } catch (error) {
    console.error("[taskflow] failed to log activity", error);
  }
}
