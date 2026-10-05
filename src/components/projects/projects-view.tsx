"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ProjectDialog,
  toProjectFormValues,
  type ProjectFormValues,
} from "@/components/projects/project-dialog";
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
import { Input } from "@/components/ui/form";
import { AvatarGroup, EmptyState, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { cn, truncate } from "@/lib/utils";
import type { ProjectSummary } from "@/server/queries";

type Member = { userId: string; name: string; role: string; avatarColor: string };

const FILTERS: { key: "active" | "archived" | "all"; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

const STATUS_VARIANTS: Record<ProjectStatus, "primary" | "success" | "warning" | "info" | "default"> = {
  ACTIVE: "primary",
  PLANNING: "info",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "default",
};

export function ProjectsView({
  projects,
  members,
  currentUserId,
  canManage,
}: {
  projects: ProjectSummary[];
  members: Member[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectFormValues | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects.filter((project) => {
      const archived = project.status === "ARCHIVED";
      if (filter === "active" && archived) return false;
      if (filter === "archived" && !archived) return false;
      if (!term) return true;
      return (
        project.name.toLowerCase().includes(term) ||
        (project.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [projects, filter, query]);

  const counts = useMemo(
    () => ({
      active: projects.filter((project) => project.status !== "ARCHIVED").length,
      archived: projects.filter((project) => project.status === "ARCHIVED").length,
      all: projects.length,
    }),
    [projects],
  );

  async function toggleArchive(project: ProjectSummary) {
    const archived = project.status === "ARCHIVED";
    setBusy(true);
    const result = await callAction("project.archive", { projectId: project.id, archived: !archived });
    setBusy(false);

    if (result.ok) {
      toast.success(result.message ?? "Project updated");
      router.refresh();
    } else {
      toast.error("Could not update project", result.error);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await callAction("project.delete", { projectId: deleting.id });
    setBusy(false);
    setDeleting(null);

    if (result.ok) {
      toast.success(result.message ?? "Project deleted");
      router.refresh();
    } else {
      toast.error("Could not delete project", result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.active} active · {counts.archived} archived
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden />
          New project
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border border-border bg-surface p-0.5"
          role="tablist"
          aria-label="Filter projects"
        >
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                filter === item.key
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{counts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? "No projects match that search" : "No projects here yet"}
          description={
            query
              ? "Try a different term, or clear the search to see everything."
              : "Create your first project to start grouping tasks, deadlines and teammates."
          }
          action={
            query ? (
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden />
                New project
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const archived = project.status === "ARCHIVED";
            const projectMembers = project.memberIds
              .map((userId) => members.find((member) => member.userId === userId))
              .filter((member): member is Member => Boolean(member));

            return (
              <Card key={project.id} className={cn("flex flex-col", archived && "opacity-80")}>
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-2 text-base font-semibold hover:text-primary"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                          aria-hidden
                        />
                        <span className="truncate">{project.name}</span>
                      </Link>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {project.description
                          ? truncate(project.description, 110)
                          : "No description yet."}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                        aria-label={`Actions for ${project.name}`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}`}>Open project</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(toProjectFormValues(project));
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit project
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void toggleArchive(project)}>
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
                        {canManage ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setDeleting(project)}>
                              <Trash2 className="size-4" aria-hidden />
                              Delete project
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                    {project.daysToDeadline !== null ? (
                      <Badge
                        variant={
                          project.status === "COMPLETED"
                            ? "success"
                            : project.daysToDeadline < 0
                              ? "danger"
                              : project.daysToDeadline <= 7
                                ? "warning"
                                : "outline"
                        }
                      >
                        <CalendarClock className="size-3" aria-hidden />
                        {project.daysToDeadline < 0
                          ? `${Math.abs(project.daysToDeadline)}d overdue`
                          : project.daysToDeadline === 0
                            ? "Due today"
                            : `${project.daysToDeadline}d left`}
                      </Badge>
                    ) : null}
                    {project.overdueCount > 0 ? (
                      <Badge variant="danger">{project.overdueCount} overdue</Badge>
                    ) : null}
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {project.doneCount}/{project.taskCount} tasks complete
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {project.progress}%
                      </span>
                    </div>
                    <Progress
                      value={project.progress}
                      label={`${project.name} progress`}
                      tone={
                        project.status === "COMPLETED"
                          ? "success"
                          : project.overdueCount > 0
                            ? "warning"
                            : "primary"
                      }
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" aria-hidden />
                        {projectMembers.length} member{projectMembers.length === 1 ? "" : "s"}
                      </span>
                      <AvatarGroup
                        people={projectMembers.map((member) => ({
                          name: member.name,
                          color: member.avatarColor,
                        }))}
                        max={4}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        members={members.map((member) => ({
          userId: member.userId,
          name: member.name,
          role: member.role,
        }))}
        currentUserId={currentUserId}
        onCreated={(projectId) => router.push(`/projects/${projectId}`)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="This permanently deletes the project and all of its tasks. Consider archiving instead if you may need the history."
        confirmLabel="Delete project"
        destructive
        loading={busy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
