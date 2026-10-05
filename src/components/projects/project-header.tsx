"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProjectDialog, toProjectFormValues } from "@/components/projects/project-dialog";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import type { MemberOption, ProjectOption } from "@/components/tasks/task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Avatar, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { truncate } from "@/lib/utils";
import type { ProjectSummary } from "@/server/queries";

const STATUS_VARIANTS: Record<ProjectStatus, "primary" | "success" | "warning" | "info" | "default"> = {
  ACTIVE: "primary",
  PLANNING: "info",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "default",
};

export function ProjectHeader({
  project,
  members,
  projectMembers,
  currentUserId,
  canManage,
  projects,
  allMembers,
}: {
  project: ProjectSummary;
  members: { userId: string; name: string; color: string }[];
  projectMembers: { userId: string; name: string; color: string; email: string; jobTitle: string | null }[];
  currentUserId: string;
  canManage: boolean;
  projects: ProjectOption[];
  allMembers: MemberOption[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const archived = project.status === "ARCHIVED";

  async function toggleArchive() {
    setBusy(true);
    const result = await callAction("project.archive", {
      projectId: project.id,
      archived: !archived,
    });
    setBusy(false);
    if (result.ok) {
      toast.success(result.message ?? "Project updated");
      router.refresh();
    } else {
      toast.error("Could not update the project", result.error);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    const result = await callAction("project.delete", { projectId: project.id });
    setBusy(false);
    setDeleteOpen(false);
    if (result.ok) {
      toast.success("Project deleted");
      router.push("/projects");
      router.refresh();
    } else {
      toast.error("Could not delete the project", result.error);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/projects" className="hover:text-foreground hover:underline">
                Projects
              </Link>
              <span aria-hidden>/</span>
              <span className="truncate">{project.name}</span>
            </div>

            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden
              />
              {project.name}
              <Badge variant={STATUS_VARIANTS[project.status]}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </h1>

            <p className="max-w-3xl text-sm text-muted-foreground">
              {project.description ? truncate(project.description, 320) : "No description yet."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {project.deadline ? (
                <Badge
                  variant={
                    project.status === "COMPLETED"
                      ? "success"
                      : (project.daysToDeadline ?? 0) < 0
                        ? "danger"
                        : (project.daysToDeadline ?? 0) <= 7
                          ? "warning"
                          : "outline"
                  }
                >
                  <CalendarClock className="size-3" aria-hidden />
                  {(project.daysToDeadline ?? 0) < 0
                    ? `Deadline passed ${Math.abs(project.daysToDeadline ?? 0)}d ago`
                    : `Due ${project.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                </Badge>
              ) : (
                <Badge variant="outline">No deadline</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Created {project.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NewTaskButton
              projects={projects}
              members={allMembers}
              defaultProjectId={project.id}
              label="Add task"
            />
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-surface-muted"
                aria-label="More project actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => void toggleArchive()}>
                  {archived ? (
                    <>
                      <ArchiveRestore className="size-4" aria-hidden />
                      Restore project
                    </>
                  ) : (
                    <>
                      <Archive className="size-4" aria-hidden />
                      Archive project
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/team">
                    <UserPlus className="size-4" aria-hidden />
                    Manage team
                  </Link>
                </DropdownMenuItem>
                {canManage ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                      <Trash2 className="size-4" aria-hidden />
                      Delete project
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {project.doneCount} of {project.taskCount} tasks complete
            </span>
            <span className="font-semibold tabular-nums">{project.progress}% complete</span>
          </div>
          <Progress
            value={project.progress}
            label={`${project.name} progress`}
            tone={project.overdueCount > 0 ? "warning" : project.progress === 100 ? "success" : "primary"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <AvatarGroupInline
                people={projectMembers.map((member) => ({ name: member.name, color: member.color }))}
              />
              <span className="text-xs text-muted-foreground">
                {projectMembers.length} member{projectMembers.length === 1 ? "" : "s"}
              </span>
            </div>
            {project.overdueCount > 0 ? (
              <Badge variant="danger">{project.overdueCount} overdue</Badge>
            ) : (
              <Badge variant="success">No overdue tasks</Badge>
            )}
          </div>
        </div>
      </CardContent>

      <ProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={toProjectFormValues(project)}
        members={members.map((member) => ({ userId: member.userId, name: member.name, role: "" }))}
        currentUserId={currentUserId}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${project.name}”?`}
        description="Every task in this project is deleted permanently. Archive it instead if you may need the history."
        confirmLabel="Delete project"
        destructive
        loading={busy}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}

function AvatarGroupInline({ people }: { people: { name: string; color: string }[] }) {
  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          color={person.color}
          size="xs"
          className={index === 0 ? "" : "-ml-2"}
        />
      ))}
      {extra > 0 ? (
        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-surface">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
