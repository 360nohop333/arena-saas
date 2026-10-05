"use client";

import { ArrowUpDown, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";

type Option = { value: string; label: string };

const DUE_OPTIONS: Option[] = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No due date" },
];

const SORT_OPTIONS: Option[] = [
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
  { value: "createdAt", label: "Created" },
];

export function TaskFilters({
  projects,
  members,
  currentUserId,
  showProjectFilter = true,
}: {
  projects: { id: string; name: string }[];
  members: { userId: string; name: string }[];
  currentUserId: string;
  showProjectFilter?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const current = {
    projectId: searchParams.get("projectId") ?? "all",
    status: searchParams.get("status") ?? "all",
    priority: searchParams.get("priority") ?? "all",
    assigneeId: searchParams.get("assigneeId") ?? "all",
    due: searchParams.get("due") ?? "all",
    sort: searchParams.get("sort") ?? "dueDate",
    dir: searchParams.get("dir") ?? "asc",
  };

  function apply(changes: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");

    startTransition(() => {
      router.replace(`/tasks?${params.toString()}`, { scroll: false });
    });
  }

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== query) {
        apply({ q: query || null });
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeCount = [
    current.projectId !== "all",
    current.status !== "all",
    current.priority !== "all",
    current.assigneeId !== "all",
    current.due !== "all",
    query.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks by title or description…"
            className="pl-9"
            aria-label="Search tasks"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {pending ? <Spinner label="Filtering…" /> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {showProjectFilter ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Project</span>
            <Select
              value={current.projectId}
              onChange={(event) => apply({ projectId: event.target.value })}
              className="h-9 text-sm"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={current.status}
            onChange={(event) => apply({ status: event.target.value })}
            className="h-9 text-sm"
          >
            <option value="all">Any status</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Priority</span>
          <Select
            value={current.priority}
            onChange={(event) => apply({ priority: event.target.value })}
            className="h-9 text-sm"
          >
            <option value="all">Any priority</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Assignee</span>
          <Select
            value={current.assigneeId}
            onChange={(event) => apply({ assigneeId: event.target.value })}
            className="h-9 text-sm"
          >
            <option value="all">Anyone</option>
            <option value={currentUserId}>Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {members
              .filter((member) => member.userId !== currentUserId)
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Due</span>
          <Select
            value={current.due}
            onChange={(event) => apply({ due: event.target.value })}
            className="h-9 text-sm"
          >
            {DUE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Sort by</span>
          <div className="flex gap-1">
            <Select
              value={current.sort}
              onChange={(event) => apply({ sort: event.target.value })}
              className="h-9 flex-1 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => apply({ dir: current.dir === "asc" ? "desc" : "asc" })}
              aria-label={`Sort ${current.dir === "asc" ? "descending" : "ascending"}`}
              title={current.dir === "asc" ? "Ascending" : "Descending"}
            >
              <ArrowUpDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        </label>
      </div>

      {activeCount > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {activeCount} filter{activeCount === 1 ? "" : "s"} active
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              startTransition(() => router.replace("/tasks", { scroll: false }));
            }}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
