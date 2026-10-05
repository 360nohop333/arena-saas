"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { TaskDialog, type MemberOption, type ProjectOption } from "@/components/tasks/task-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

/** "New task" button + dialog, used on the tasks page and project header. */
export function NewTaskButton({
  projects,
  members,
  defaultProjectId,
  label = "New task",
  variant = "primary",
  size = "md",
  disabled = false,
}: {
  projects: ProjectOption[];
  members: MemberOption[];
  defaultProjectId?: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        disabled={disabled || projects.length === 0}
        title={projects.length === 0 ? "Create a project first" : undefined}
      >
        <Plus aria-hidden />
        {label}
      </Button>

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects}
        members={members}
        defaultProjectId={defaultProjectId}
      />
    </>
  );
}
