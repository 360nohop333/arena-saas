"use client";

import { CalendarDays, CheckCircle2, Circle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TaskDialog, toFormValues, type MemberOption, type ProjectOption } from "@/components/tasks/task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { Avatar, EmptyState, ErrorState, Td, Th, TableWrapper } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { STATUS_LABELS, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/constants";
import { cn, priorityLabel } from "@/lib/utils";
import type { TaskRow } from "@/server/queries";

const PRIORITY_VARIANTS: Record<Priority, "danger" | "warning" | "info" | "default"> = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "default",
};

function formatDue(date: Date | null, overdue: boolean, status: TaskStatus) {
  if (!date) return "—";
  const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (status === "DONE") return label;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const days = Math.round((value.getTime() - today.getTime()) / 86_400_000);

  if (overdue) return `${label} · ${Math.abs(days)}d late`;
  if (days === 0) return `${label} · today`;
  if (days === 1) return `${label} · tomorrow`;
  return label;
}

export function TaskList({
  tasks,
  members,
  projects,
  showProject = true,
  emptyTitle = "No tasks found",
  emptyDescription = "Try adjusting your filters, or create a new task.",
  onCreate,
  pageSize,
}: {
  tasks: TaskRow[];
  members: MemberOption[];
  projects: ProjectOption[];
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onCreate?: () => void;
  pageSize?: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function toggle(task: TaskRow) {
    setBusyIds((ids) => [...ids, task.id]);
    setFailed(null);
    const nextStatus: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    const result = await callAction("task.toggle", { taskId: task.id, status: nextStatus });
    setBusyIds((ids) => ids.filter((id) => id !== task.id));

    if (result.ok) {
      toast.success(nextStatus === "DONE" ? "Task completed 🎉" : "Task reopened");
      router.refresh();
    } else {
      setFailed(result.error);
      toast.error("Could not update the task", result.error);
    }
  }

  async function changeStatus(task: TaskRow, status: TaskStatus) {
    setBusyIds((ids) => [...ids, task.id]);
    const result = await callAction("task.update", { id: task.id, status });
    setBusyIds((ids) => ids.filter((id) => id !== task.id));

    if (result.ok) {
      toast.success("Status updated", `${task.title} → ${STATUS_LABELS[status]}`);
      router.refresh();
    } else {
      toast.error("Could not update the status", result.error);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setConfirmBusy(true);
    const result = await callAction("task.delete", { taskId: deleting.id });
    setConfirmBusy(false);
    setDeleting(null);

    if (result.ok) {
      toast.success("Task deleted");
      router.refresh();
    } else {
      toast.error("Could not delete the task", result.error);
    }
  }

  if (failed) {
    return (
      <ErrorState
        title="We could not load your tasks"
        description={failed}
        onRetry={() => {
          setFailed(null);
          router.refresh();
        }}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="size-5" aria-hidden />}
        title={emptyTitle}
        description={emptyDescription}
        action={
          onCreate ? (
            <Button onClick={onCreate}>Create a task</Button>
          ) : (
            <Button variant="secondary" onClick={() => router.push("/tasks")}>
              Browse all tasks
            </Button>
          )
        }
      />
    );
  }

  return (
    <>
      <TableWrapper>
        <thead>
          <tr>
            <Th className="w-12">
              <span className="sr-only">Complete</span>
            </Th>
            <Th>Task</Th>
            {showProject ? <Th className="hidden md:table-cell">Project</Th> : null}
            <Th>Status</Th>
            <Th>Priority</Th>
            <Th className="hidden lg:table-cell">Assignee</Th>
            <Th>Due</Th>
            <Th className="w-12">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const busy = busyIds.includes(task.id);
            const done = task.status === "DONE";
            return (
              <tr
                key={task.id}
                className={cn("transition hover:bg-surface-muted/50", busy && "opacity-60")}
              >
                <Td>
                  <button
                    type="button"
                    onClick={() => void toggle(task)}
                    disabled={busy}
                    aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    className="rounded-full text-muted-foreground transition hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    {done ? (
                      <CheckCircle2 className="size-5 text-emerald-500" aria-hidden />
                    ) : (
                      <Circle className="size-5" aria-hidden />
                    )}
                  </button>
                </Td>

                <Td>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate font-medium",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                </Td>

                {showProject ? (
                  <Td className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: task.projectColor }}
                        aria-hidden
                      />
                      <span className="max-w-36 truncate">{task.projectName}</span>
                    </span>
                  </Td>
                ) : null}

                <Td>
                  <label className="sr-only" htmlFor={`status-${task.id}`}>
                    Status for {task.title}
                  </label>
                  <Select
                    id={`status-${task.id}`}
                    value={task.status}
                    disabled={busy}
                    onChange={(event) => void changeStatus(task, event.target.value as TaskStatus)}
                    className="h-8 w-32 text-xs"
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </Td>

                <Td>
                  <Badge variant={PRIORITY_VARIANTS[task.priority]}>
                    {priorityLabel(task.priority)}
                  </Badge>
                </Td>

                <Td className="hidden lg:table-cell">
                  {task.assigneeName ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={task.assigneeName} color={task.assigneeColor} size="xs" />
                      <span className="max-w-28 truncate text-sm">{task.assigneeName}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </Td>

                <Td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs",
                      task.isOverdue ? "font-semibold text-danger" : "text-muted-foreground",
                    )}
                  >
                    <CalendarDays className="size-3.5" aria-hidden />
                    {formatDue(task.dueDate, task.isOverdue, task.status)}
                  </span>
                </Td>

                <Td>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                      aria-label={`Actions for ${task.title}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setEditing(task)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit task
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void toggle(task)}>
                        {done ? "Reopen task" : "Mark complete"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(task)}>
                        <Trash2 className="size-4" aria-hidden />
                        Delete task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrapper>

      {pageSize ? (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing up to {pageSize} tasks per page
        </p>
      ) : null}

      <TaskDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing ? toFormValues(editing) : null}
        projects={projects}
        members={members}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This task will be permanently removed from the project."
        confirmLabel="Delete task"
        destructive
        loading={confirmBusy}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
