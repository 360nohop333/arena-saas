"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";

export type ProjectOption = { id: string; name: string; color: string; status?: string };
export type MemberOption = { userId: string; name: string };

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assigneeId: string;
  projectId: string;
};

export const emptyTask: TaskFormValues = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  assigneeId: "",
  projectId: "",
};

/** Create/edit dialog for a task. Shared by the task page, project page and the top bar. */
export function TaskDialog({
  open,
  onOpenChange,
  initial,
  projects,
  members,
  defaultProjectId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: TaskFormValues | null;
  projects: ProjectOption[];
  members: MemberOption[];
  defaultProjectId?: string;
  onSaved?: (message: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<TaskFormValues>(initial ?? emptyTask);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setValues(
        initial ?? {
          ...emptyTask,
          projectId: defaultProjectId ?? projects[0]?.id ?? "",
        },
      );
      setFieldErrors({});
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, defaultProjectId]);

  const update = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      id: values.id,
      title: values.title,
      description: values.description,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate || null,
      assigneeId: values.assigneeId || null,
      projectId: values.projectId,
    };

    const result = isEdit
      ? await callAction<{ taskId: string }>("task.update", payload)
      : await callAction<{ taskId: string }>("task.create", payload);

    setPending(false);

    if (result.ok) {
      toast.success(result.message ?? (isEdit ? "Task updated" : "Task created"));
      onOpenChange(false);
      onSaved?.(result.message ?? "Task saved");
      router.refresh();
      return;
    }

    setFormError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    if (result.code === "VALIDATION") {
      toast.error("Please check the form", result.error);
    } else {
      toast.error("Could not save the task", result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details, priority or owner of this task."
              : "Add a task to one of your projects and assign an owner."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError ? (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}

          <Field label="Task title" htmlFor="task-title" required error={fieldErrors.title}>
            <Input
              id="task-title"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="e.g. Draft the onboarding email sequence"
              autoFocus
              required
              minLength={2}
              maxLength={140}
              aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
              aria-invalid={Boolean(fieldErrors.title)}
            />
          </Field>

          <Field label="Description" htmlFor="task-description" error={fieldErrors.description}>
            <Textarea
              id="task-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Add context, acceptance criteria or links…"
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" htmlFor="task-project" required error={fieldErrors.projectId}>
              <Select
                id="task-project"
                value={values.projectId}
                onChange={(event) => update("projectId", event.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.projectId)}
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Assignee" htmlFor="task-assignee" error={fieldErrors.assigneeId}>
              <Select
                id="task-assignee"
                value={values.assigneeId}
                onChange={(event) => update("assigneeId", event.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Priority" htmlFor="task-priority" error={fieldErrors.priority}>
              <Select
                id="task-priority"
                value={values.priority}
                onChange={(event) => update("priority", event.target.value as Priority)}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="task-status" error={fieldErrors.status}>
              <Select
                id="task-status"
                value={values.status}
                onChange={(event) => update("status", event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Due date"
              htmlFor="task-due"
              error={fieldErrors.dueDate}
              hint="Optional — tasks without a due date sort last."
              className="sm:col-span-2"
            >
              <Input
                id="task-due"
                type="date"
                value={values.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Saving…">
              {isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Convert a task row from the server into dialog form values. */
export function toFormValues(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  assigneeId: string | null;
  projectId: string;
}): TaskFormValues {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: task.status as TaskStatus,
    priority: task.priority as Priority,
    dueDate: toDateInputValue(task.dueDate),
    assigneeId: task.assigneeId ?? "",
    projectId: task.projectId,
  };
}
