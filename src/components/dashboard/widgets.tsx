import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarGroup, Progress } from "@/components/ui/misc";
import type { ActivityItem } from "@/lib/activity";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type TaskStatus } from "@/lib/constants";
import { cn, priorityLabel, truncate } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                 Stat cards                                  */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "primary" | "success" | "danger" | "warning";
  trend?: { value: number; label: string };
}) {
  const tones = {
    default: "bg-surface-muted text-muted-foreground",
    primary: "bg-accent text-primary",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  } as const;

  const content = (
    <Card
      className={cn(
        "h-full transition",
        href && "hover:-translate-y-0.5 hover:border-primary/40",
      )}
    >
      <CardContent className="flex items-start gap-4 p-5">
        <span className={cn("flex size-10 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          {trend ? (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                trend.value >= 0 ? "text-success" : "text-danger",
              )}
            >
              {trend.value >= 0 ? (
                <ArrowUpRight className="size-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden />
              )}
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
      {content}
    </Link>
  ) : (
    content
  );
}

/* -------------------------------------------------------------------------- */
/*                              Productivity chart                             */
/* -------------------------------------------------------------------------- */

export function ProductivityChart({
  trend,
  completedLast7Days,
  completedPrevious7Days,
}: {
  trend: { label: string; completed: number; created: number }[];
  completedLast7Days: number;
  completedPrevious7Days: number;
}) {
  const max = Math.max(1, ...trend.map((day) => Math.max(day.completed, day.created)));
  const delta =
    completedPrevious7Days === 0
      ? completedLast7Days > 0
        ? 100
        : 0
      : Math.round(((completedLast7Days - completedPrevious7Days) / completedPrevious7Days) * 100);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Completion trend</CardTitle>
          <p className="text-sm text-muted-foreground">Tasks completed vs created, last 14 days</p>
        </div>
        <Badge variant={delta >= 0 ? "success" : "danger"}>
          {delta >= 0 ? "+" : ""}
          {delta}% vs previous week
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Bar chart of tasks completed and created over the last 14 days">
          {trend.map((day) => (
            <div key={day.label} className="group flex h-full flex-1 flex-col justify-end gap-0.5">
              <div className="relative flex h-full items-end gap-0.5">
                <div
                  className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                  style={{ height: `${(day.completed / max) * 100}%` }}
                  title={`${day.label}: ${day.completed} completed`}
                />
                <div
                  className="w-full rounded-t bg-border-strong"
                  style={{ height: `${(day.created / max) * 100}%` }}
                  title={`${day.label}: ${day.created} created`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{trend[0]?.label}</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden /> Completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-border-strong" aria-hidden /> Created
            </span>
          </div>
          <span>{trend.at(-1)?.label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Status breakdown                               */
/* -------------------------------------------------------------------------- */

const STATUS_TONES: Record<TaskStatus, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-primary",
  REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
};

export function StatusBreakdown({
  byStatus,
  total,
}: {
  byStatus: { status: TaskStatus; count: number }[];
  total: number;
}) {
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row.count])) as Record<
    string,
    number
  >;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Status breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">{total} tasks in this workspace</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as TaskStatus[]).map((status) => {
          const count = counts[status] ?? 0;
          const percent = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div key={status} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className={cn("size-2.5 rounded-full", STATUS_TONES[status])} aria-hidden />
                  {STATUS_LABELS[status]}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {count} · {percent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={cn("h-full rounded-full", STATUS_TONES[status])}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PriorityBreakdown({
  byPriority,
}: {
  byPriority: { priority: Priority; count: number }[];
}) {
  const counts = Object.fromEntries(byPriority.map((row) => [row.priority, row.count])) as Record<
    string,
    number
  >;
  const variants: Record<Priority, "danger" | "warning" | "info" | "default"> = {
    URGENT: "danger",
    HIGH: "warning",
    MEDIUM: "info",
    LOW: "default",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority mix</CardTitle>
        <p className="text-sm text-muted-foreground">Where the pressure is</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((priority) => (
          <Badge key={priority} variant={variants[priority]} className="px-3 py-1">
            {PRIORITY_LABELS[priority]}: {counts[priority] ?? 0}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Activity feed                                */
/* -------------------------------------------------------------------------- */

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet — create a project or task to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <p className="text-sm text-muted-foreground">Everything happening in this workspace</p>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span
                className="absolute -left-[26px] top-1 size-2.5 rounded-full border-2 border-surface"
                style={{ backgroundColor: item.actorColor ?? "#94a3b8" }}
                aria-hidden
              />
              <p className="text-sm">
                <span className="font-semibold">{item.actorName ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{item.message}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <time dateTime={item.createdAt.toISOString()}>{relativeTime(item.createdAt)}</time>
                {item.projectName ? (
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/projects/${item.projectId}`} className="hover:text-foreground hover:underline">
                      {item.projectName}
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function relativeTime(date: Date | string, now = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((now.getTime() - value.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* -------------------------------------------------------------------------- */
/*                              Project progress                               */
/* -------------------------------------------------------------------------- */

export function ProjectProgressList({
  projects,
}: {
  projects: {
    id: string;
    name: string;
    color: string;
    progress: number;
    taskCount: number;
    doneCount: number;
    overdueCount: number;
    daysToDeadline: number | null;
    members: { name: string; color?: string | null }[];
  }[];
}) {
  if (projects.length === 0) return null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Active project progress</CardTitle>
        <p className="text-sm text-muted-foreground">Weighted by completed tasks</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {projects.slice(0, 4).map((project) => (
          <div key={project.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold hover:text-primary"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                <span className="truncate">{truncate(project.name, 34)}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {project.overdueCount > 0 ? (
                  <Badge variant="danger" size="sm">
                    {project.overdueCount} overdue
                  </Badge>
                ) : null}
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {project.progress}%
                </span>
              </div>
            </div>
            <Progress
              value={project.progress}
              label={`${project.name} progress`}
              tone={project.overdueCount > 0 ? "warning" : "primary"}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {project.doneCount}/{project.taskCount} tasks
                {project.daysToDeadline !== null ? (
                  <>
                    {" · "}
                    {project.daysToDeadline < 0
                      ? `${Math.abs(project.daysToDeadline)}d overdue`
                      : `${project.daysToDeadline}d left`}
                  </>
                ) : null}
              </span>
              <AvatarGroup people={project.members} max={3} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function WorkloadList({
  workload,
}: {
  workload: { name: string; color: string; open: number; done: number }[];
}) {
  const max = Math.max(1, ...workload.map((person) => person.open + person.done));

  if (workload.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team workload</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">
            No assigned tasks yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team workload</CardTitle>
        <p className="text-sm text-muted-foreground">Open vs completed assignments</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {workload.map((person) => (
          <div key={person.name} className="flex items-center gap-3">
            <Avatar name={person.name} color={person.color} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{person.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {person.open} open · {person.done} done
                </span>
              </div>
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(person.open / max) * 100}%` }}
                  aria-hidden
                />
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(person.done / max) * 100}%` }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Task list                                   */
/* -------------------------------------------------------------------------- */

export function MiniTaskList({
  title,
  description,
  tasks,
  emptyMessage,
  action,
}: {
  title: string;
  description?: string;
  tasks: {
    id: string;
    title: string;
    dueDate: Date | null;
    priority: string;
    projectName: string;
    projectColor: string;
    isOverdue: boolean;
  }[];
  emptyMessage: string;
  action?: ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: task.projectColor }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.projectName}
                    {task.dueDate
                      ? ` · due ${task.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : ""}
                  </p>
                </div>
                <Badge
                  size="sm"
                  variant={task.isOverdue ? "danger" : task.priority === "URGENT" ? "warning" : "default"}
                >
                  {task.isOverdue ? "Overdue" : priorityLabel(task.priority)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
