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
  PROJECT_COLORS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/constants";
import { cn, toDateInputValue } from "@/lib/utils";

export type ProjectFormValues = {
  id?: string;
  name: string;
  description: string;
  status: ProjectStatus;
  deadline: string;
  color: string;
  memberIds: string[];
};

export const emptyProject: ProjectFormValues = {
  name: "",
  description: "",
  status: "ACTIVE",
  deadline: "",
  color: PROJECT_COLORS[0],
  memberIds: [],
};

/** Create/edit dialog for a project, including its team. */
export function ProjectDialog({
  open,
  onOpenChange,
  initial,
  members,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectFormValues | null;
  members: { userId: string; name: string; role: string }[];
  currentUserId: string;
  onCreated?: (projectId: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<ProjectFormValues>(initial ?? emptyProject);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setValues(initial ?? { ...emptyProject, memberIds: [currentUserId] });
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, initial, currentUserId]);

  const update = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function toggleMember(userId: string) {
    setValues((current) => ({
      ...current,
      memberIds: current.memberIds.includes(userId)
        ? current.memberIds.filter((id) => id !== userId)
        : [...current.memberIds, userId],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      id: values.id,
      name: values.name,
      description: values.description,
      status: values.status,
      deadline: values.deadline || null,
      color: values.color,
      memberIds: values.memberIds,
    };

    const result = isEdit
      ? await callAction<{ projectId: string }>("project.update", payload)
      : await callAction<{ projectId: string }>("project.create", payload);

    setPending(false);

    if (result.ok) {
      toast.success(result.message ?? (isEdit ? "Project updated" : "Project created"));
      onOpenChange(false);
      router.refresh();
      const id = result.data?.projectId;
      if (id) onCreated?.(id);
      return;
    }

    setFormError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    toast.error(isEdit ? "Could not update project" : "Could not create project", result.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            Projects group tasks, deadlines and teammates around one outcome.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError ? (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}

          <Field label="Project name" htmlFor="project-name" required error={fieldErrors.name}>
            <Input
              id="project-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Website redesign"
              autoFocus
              required
              minLength={2}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.name)}
            />
          </Field>

          <Field label="Description" htmlFor="project-description" error={fieldErrors.description}>
            <Textarea
              id="project-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="What does success look like? The AI assistant uses this to break the work down."
              maxLength={2000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="project-status" error={fieldErrors.status}>
              <Select
                id="project-status"
                value={values.status}
                onChange={(event) => update("status", event.target.value as ProjectStatus)}
              >
                {PROJECT_STATUSES.filter((status) => status !== "ARCHIVED").map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Deadline" htmlFor="project-deadline" error={fieldErrors.deadline}>
              <Input
                id="project-deadline"
                type="date"
                value={values.deadline}
                onChange={(event) => update("deadline", event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update("color", color)}
                  aria-label={`Use colour ${color}`}
                  aria-pressed={values.color === color}
                  className={cn(
                    "size-8 rounded-full border-2 transition",
                    values.color === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Project members</legend>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2 scrollbar-thin">
              {members.map((member) => {
                const checked = values.memberIds.includes(member.userId);
                return (
                  <label
                    key={member.userId}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition hover:bg-surface-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(member.userId)}
                      className="size-4 rounded border-border-strong text-primary accent-[var(--primary)]"
                    />
                    <span className="font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground">{member.role.toLowerCase()}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Saving…">
              {isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function toProjectFormValues(project: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: Date | string | null;
  color: string;
  memberIds: string[];
}): ProjectFormValues {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    status: project.status as ProjectStatus,
    deadline: toDateInputValue(project.deadline),
    color: project.color,
    memberIds: project.memberIds,
  };
}
