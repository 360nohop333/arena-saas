import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, like, ne, or, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { activities, memberships, projectMembers, projects, tasks, users } from "@/db/schema";
import { startOfDay } from "@/lib/ai/engine";
import type { TaskFilterInput } from "@/lib/validation";
import type { ActivityItem } from "@/lib/activity";
import type { Priority, ProjectStatus, TaskStatus } from "@/lib/constants";

const DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*                                  Projects                                   */
/* -------------------------------------------------------------------------- */

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  deadline: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
  memberIds: string[];
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  progress: number;
  daysToDeadline: number | null;
};

export async function listProjects(
  workspaceId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ProjectSummary[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(
      options.includeArchived
        ? eq(projects.workspaceId, workspaceId)
        : and(eq(projects.workspaceId, workspaceId), ne(projects.status, "ARCHIVED")),
    )
    .orderBy(sql`case when ${projects.archivedAt} is null then 0 else 1 end`, desc(projects.updatedAt));

  const projectIds = rows.map((row) => row.id);
  const todayStart = startOfDay(new Date()).getTime();

  const [memberRows, taskRows] = await Promise.all([
    projectIds.length
      ? db
          .select({ projectId: projectMembers.projectId, userId: projectMembers.userId })
          .from(projectMembers)
          .where(inArray(projectMembers.projectId, projectIds))
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ projectId: tasks.projectId, status: tasks.status, dueDate: tasks.dueDate })
          .from(tasks)
          .where(inArray(tasks.projectId, projectIds))
      : Promise.resolve([]),
  ]);

  return rows.map((row) => {
    const projectTasks = taskRows.filter((task) => task.projectId === row.id);
    const doneCount = projectTasks.filter((task) => task.status === "DONE").length;
    const overdueCount = projectTasks.filter(
      (task) =>
        task.status !== "DONE" && task.dueDate && startOfDay(task.dueDate).getTime() < todayStart,
    ).length;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status as ProjectStatus,
      color: row.color,
      deadline: row.deadline,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ownerId: row.ownerId,
      memberIds: memberRows.filter((member) => member.projectId === row.id).map((m) => m.userId),
      taskCount: projectTasks.length,
      doneCount,
      overdueCount,
      progress: projectTasks.length === 0 ? 0 : Math.round((doneCount / projectTasks.length) * 100),
      daysToDeadline: row.deadline
        ? Math.round((startOfDay(row.deadline).getTime() - todayStart) / DAY)
        : null,
    };
  });
}

export const getProject = cache(async (projectId: string, workspaceId: string) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);

  if (!project) return null;

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
      jobTitle: users.jobTitle,
      addedAt: projectMembers.addedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(users.name));

  return { ...project, members };
});

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

/** Project id + name/colour map for pickers and badges. */
export async function getProjectOptions(workspaceId: string) {
  return db
    .select({ id: projects.id, name: projects.name, color: projects.color, status: projects.status })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name));
}

/* -------------------------------------------------------------------------- */
/*                                    Tasks                                    */
/* -------------------------------------------------------------------------- */

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  projectName: string;
  projectColor: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  isOverdue: boolean;
};

function selectTaskRow() {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectId: tasks.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      assigneeColor: users.avatarColor,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id));
}

type RawTaskRow = Awaited<ReturnType<ReturnType<typeof selectTaskRow>["execute"]>>[number];

function mapTaskRow(row: RawTaskRow, today = new Date()): TaskRow {
  return {
    ...row,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    isOverdue:
      row.status !== "DONE" &&
      !!row.dueDate &&
      startOfDay(row.dueDate).getTime() < startOfDay(today).getTime(),
  };
}

/** SQL rank so priority sorting works consistently across dialects. */
const priorityRank = sql`case ${tasks.priority}
  when 'URGENT' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end`;

const nullsLast = sql`case when ${tasks.dueDate} is null then 1 else 0 end`;

export type TaskListResult = {
  tasks: TaskRow[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listTasks(
  workspaceId: string,
  filters: TaskFilterInput,
  options: { pageSize?: number } = {},
): Promise<TaskListResult> {
  const pageSize = options.pageSize ?? 12;
  const page = Math.max(1, filters.page ?? 1);
  const todayStart = startOfDay(new Date());

  const conditions = [eq(tasks.workspaceId, workspaceId)];

  if (filters.projectId && filters.projectId !== "all") {
    conditions.push(eq(tasks.projectId, filters.projectId));
  }
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters.priority && filters.priority !== "all") {
    conditions.push(eq(tasks.priority, filters.priority));
  }
  if (filters.assigneeId && filters.assigneeId !== "all") {
    conditions.push(
      filters.assigneeId === "unassigned"
        ? isNull(tasks.assigneeId)
        : eq(tasks.assigneeId, filters.assigneeId),
    );
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(like(tasks.title, term), like(tasks.description, term))!);
  }

  switch (filters.due) {
    case "overdue":
      conditions.push(lt(tasks.dueDate, todayStart), ne(tasks.status, "DONE"));
      break;
    case "today":
      conditions.push(
        gte(tasks.dueDate, todayStart),
        lt(tasks.dueDate, new Date(todayStart.getTime() + DAY)),
      );
      break;
    case "week":
      conditions.push(
        gte(tasks.dueDate, todayStart),
        lt(tasks.dueDate, new Date(todayStart.getTime() + 7 * DAY)),
      );
      break;
    case "none":
      conditions.push(isNull(tasks.dueDate));
      break;
    default:
      break;
  }

  const where = and(...conditions);

  const orderBy = (() => {
    switch (filters.sort) {
      case "priority":
        return filters.dir === "desc" ? [desc(priorityRank)] : [asc(priorityRank)];
      case "title":
        return filters.dir === "desc" ? [desc(tasks.title)] : [asc(tasks.title)];
      case "createdAt":
        return filters.dir === "desc" ? [desc(tasks.createdAt)] : [asc(tasks.createdAt)];
      case "status":
        return filters.dir === "desc" ? [desc(tasks.status)] : [asc(tasks.status)];
      default:
        // Always push tasks without a due date to the end.
        return filters.dir === "desc"
          ? [desc(nullsLast), desc(tasks.dueDate)]
          : [asc(nullsLast), asc(tasks.dueDate)];
    }
  })();

  const [rows, total] = await Promise.all([
    selectTaskRow()
      .where(where)
      .orderBy(...orderBy, desc(tasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(tasks)
      .where(where)
      .then((result) => Number(result[0]?.value ?? 0)),
  ]);

  return {
    tasks: rows.map((row) => mapTaskRow(row)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Every task for a project — used by the board view and the AI assistant. */
export async function listProjectTasks(projectId: string): Promise<TaskRow[]> {
  const rows = await selectTaskRow()
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(priorityRank), asc(nullsLast), asc(tasks.dueDate), desc(tasks.createdAt));
  return rows.map((row) => mapTaskRow(row));
}

export async function listMyTasks(workspaceId: string, userId: string, limit = 6): Promise<TaskRow[]> {
  const rows = await selectTaskRow()
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.assigneeId, userId),
        ne(tasks.status, "DONE"),
      ),
    )
    .orderBy(asc(nullsLast), asc(tasks.dueDate))
    .limit(limit);
  return rows.map((row) => mapTaskRow(row));
}

export type TaskStats = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  dueToday: number;
  todo: number;
  inProgress: number;
  review: number;
  unassigned: number;
  completionRate: number;
};

export async function getTaskStats(workspaceId: string): Promise<TaskStats> {
  const todayStart = startOfDay(new Date());

  const [statusRows, overdue, dueToday, total, unassigned, done] = await Promise.all([
    db
      .select({ status: tasks.status, value: count() })
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .groupBy(tasks.status),
    db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          ne(tasks.status, "DONE"),
          lt(tasks.dueDate, todayStart),
        ),
      )
      .then((r) => Number(r[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          ne(tasks.status, "DONE"),
          gte(tasks.dueDate, todayStart),
          lt(tasks.dueDate, new Date(todayStart.getTime() + DAY)),
        ),
      )
      .then((r) => Number(r[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .then((r) => Number(r[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          isNull(tasks.assigneeId),
          ne(tasks.status, "DONE"),
        ),
      )
      .then((r) => Number(r[0]?.value ?? 0)),
    db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.status, "DONE")))
      .then((r) => Number(r[0]?.value ?? 0)),
  ]);

  const byStatus = Object.fromEntries(
    statusRows.map((row) => [row.status, Number(row.value)]),
  ) as Record<string, number>;

  return {
    total,
    done,
    open: total - done,
    overdue,
    dueToday,
    todo: byStatus.TODO ?? 0,
    inProgress: byStatus.IN_PROGRESS ?? 0,
    review: byStatus.REVIEW ?? 0,
    unassigned,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/* -------------------------------------------------------------------------- */
/*                              Activity feed                                  */
/* -------------------------------------------------------------------------- */

export async function recentActivity(workspaceId: string, limit = 10): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      message: activities.message,
      metadata: activities.metadata,
      createdAt: activities.createdAt,
      projectId: activities.projectId,
      projectName: projects.name,
      actorName: users.name,
      actorColor: users.avatarColor,
    })
    .from(activities)
    .leftJoin(projects, eq(activities.projectId, projects.id))
    .leftJoin(users, eq(activities.actorId, users.id))
    .where(eq(activities.workspaceId, workspaceId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.createdAt,
    projectId: row.projectId,
    projectName: row.projectName,
    actorName: row.actorName,
    actorColor: row.actorColor,
    metadata: safeParse(row.metadata),
  }));
}

function safeParse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Dashboard                                   */
/* -------------------------------------------------------------------------- */

export type DashboardData = {
  stats: TaskStats;
  projects: ProjectSummary[];
  activity: ActivityItem[];
  myTasks: TaskRow[];
  upcoming: TaskRow[];
  productivity: {
    completedLast7Days: number;
    completedPrevious7Days: number;
    trend: { date: string; label: string; completed: number; created: number }[];
    byStatus: { status: TaskStatus; count: number }[];
    byPriority: { priority: Priority; count: number }[];
    workload: { name: string; color: string; open: number; done: number }[];
  };
  projectCount: number;
  archivedCount: number;
  memberCount: number;
};

export async function getDashboardData(workspaceId: string, userId: string): Promise<DashboardData> {
  const todayStart = startOfDay(new Date());
  const trendStart = new Date(todayStart.getTime() - 13 * DAY);

  const [stats, projectList, activity, myTasks, memberRows, trendTasks, statusRows, priorityRows, upcomingRows, workloadRows, archivedRows] =
    await Promise.all([
      getTaskStats(workspaceId),
      listProjects(workspaceId),
      recentActivity(workspaceId, 10),
      listMyTasks(workspaceId, userId, 6),
      db
        .select({ value: count() })
        .from(memberships)
        .where(eq(memberships.workspaceId, workspaceId)),
      db
        .select({ completedAt: tasks.completedAt, createdAt: tasks.createdAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, workspaceId),
            or(gte(tasks.completedAt, trendStart), gte(tasks.createdAt, trendStart)),
          ),
        ),
      db
        .select({ status: tasks.status, value: count() })
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .groupBy(tasks.status),
      db
        .select({ priority: tasks.priority, value: count() })
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .groupBy(tasks.priority),
      selectTaskRow()
        .where(
          and(
            eq(tasks.workspaceId, workspaceId),
            ne(tasks.status, "DONE"),
            isNotNull(tasks.dueDate),
            gte(tasks.dueDate, todayStart),
          ),
        )
        .orderBy(asc(tasks.dueDate))
        .limit(5),
      db
        .select({
          assigneeId: tasks.assigneeId,
          status: tasks.status,
          name: users.name,
          color: users.avatarColor,
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.assigneeId, users.id))
        .where(eq(tasks.workspaceId, workspaceId)),
      db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, "ARCHIVED"))),
    ]);

  const trend: DashboardData["productivity"]["trend"] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    trend.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      completed: trendTasks.filter(
        (task) => task.completedAt && task.completedAt >= dayStart && task.completedAt < dayEnd,
      ).length,
      created: trendTasks.filter((task) => task.createdAt >= dayStart && task.createdAt < dayEnd).length,
    });
  }

  const workloadMap = new Map<string, { name: string; color: string; open: number; done: number }>();
  for (const row of workloadRows) {
    if (!row.assigneeId) continue;
    const entry =
      workloadMap.get(row.assigneeId) ?? { name: row.name, color: row.color, open: 0, done: 0 };
    if (row.status === "DONE") entry.done += 1;
    else entry.open += 1;
    workloadMap.set(row.assigneeId, entry);
  }

  return {
    stats,
    projects: projectList,
    activity,
    myTasks,
    upcoming: upcomingRows.map((row) => mapTaskRow(row)),
    productivity: {
      completedLast7Days: trend.slice(-7).reduce((sum, day) => sum + day.completed, 0),
      completedPrevious7Days: trend.slice(0, 7).reduce((sum, day) => sum + day.completed, 0),
      trend,
      byStatus: statusRows.map((row) => ({
        status: row.status as TaskStatus,
        count: Number(row.value),
      })),
      byPriority: priorityRows.map((row) => ({
        priority: row.priority as Priority,
        count: Number(row.value),
      })),
      workload: [...workloadMap.values()].sort((a, b) => b.open - a.open).slice(0, 5),
    },
    projectCount: projectList.length,
    archivedCount: Number(archivedRows[0]?.value ?? 0),
    memberCount: Number(memberRows[0]?.value ?? 0),
  };
}
