import Link from "next/link";
import { Suspense } from "react";

import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/misc";
import { getWorkspaceContext } from "@/lib/workspace";
import { getProjectOptions, getTaskStats, listTasks } from "@/server/queries";
import { taskFilterSchema } from "@/lib/validation";

export const metadata = { title: "Tasks" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await getWorkspaceContext();
  const rawParams = await searchParams;

  const parsed = taskFilterSchema.safeParse({
    q: firstValue(rawParams.q),
    projectId: firstValue(rawParams.projectId),
    status: firstValue(rawParams.status),
    priority: firstValue(rawParams.priority),
    assigneeId: firstValue(rawParams.assigneeId),
    due: firstValue(rawParams.due),
    sort: firstValue(rawParams.sort),
    dir: firstValue(rawParams.dir),
    page: firstValue(rawParams.page),
  });

  const filters = parsed.success
    ? parsed.data
    : taskFilterSchema.parse({ page: 1 });

  const [result, projects, stats] = await Promise.all([
    listTasks(context.workspace.id, filters),
    getProjectOptions(context.workspace.id),
    getTaskStats(context.workspace.id),
  ]);

  const members = context.members.map((member) => ({
    userId: member.userId,
    name: member.name,
  }));

  const pageParam = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      const single = firstValue(value);
      if (single && key !== "page") params.set(key, single);
    }
    params.set("page", String(page));
    return `/tasks?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.open} open · {stats.overdue} overdue · {stats.dueToday} due today ·{" "}
            {stats.unassigned} unassigned
          </p>
        </div>
        <NewTaskButton
          projects={projects}
          members={members}
          defaultProjectId={filters.projectId !== "all" ? filters.projectId : undefined}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Suspense fallback={<Spinner label="Loading filters…" />}>
            <TaskFilters projects={projects} members={members} currentUserId={context.user.id} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {result.total} task{result.total === 1 ? "" : "s"} match
              {filters.q ? ` “${filters.q}”` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Page {result.page} of {result.pageCount}
            </p>
          </div>

          <TaskList
            tasks={result.tasks}
            members={members}
            projects={projects}
            emptyTitle={filters.q ? "No tasks match your search" : "No tasks match these filters"}
            emptyDescription="Adjust the filters above, or create a new task to get started."
          />

          {result.pageCount > 1 ? (
            <nav
              className="flex items-center justify-between gap-2 border-t border-border px-4 py-3"
              aria-label="Pagination"
            >
              <Link
                href={pageParam(Math.max(1, result.page - 1))}
                aria-disabled={result.page <= 1}
                className={
                  result.page <= 1
                    ? "pointer-events-none inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground opacity-50"
                    : "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition hover:bg-surface-muted"
                }
              >
                ← Previous
              </Link>

              <div className="flex items-center gap-1">
                {Array.from({ length: result.pageCount }, (_, index) => index + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === result.pageCount ||
                      Math.abs(page - result.page) <= 1,
                  )
                  .map((page, index, list) => (
                    <span key={page} className="flex items-center gap-1">
                      {index > 0 && page - list[index - 1] > 1 ? (
                        <span className="px-1 text-muted-foreground">…</span>
                      ) : null}
                      <Link
                        href={pageParam(page)}
                        aria-current={page === result.page ? "page" : undefined}
                        className={
                          page === result.page
                            ? "inline-flex size-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-primary"
                            : "inline-flex size-9 items-center justify-center rounded-md text-sm text-muted-foreground transition hover:bg-surface-muted"
                        }
                      >
                        {page}
                      </Link>
                    </span>
                  ))}
              </div>

              <Link
                href={pageParam(Math.min(result.pageCount, result.page + 1))}
                aria-disabled={result.page >= result.pageCount}
                className={
                  result.page >= result.pageCount
                    ? "pointer-events-none inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground opacity-50"
                    : "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition hover:bg-surface-muted"
                }
              >
                Next →
              </Link>
            </nav>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: use the status dropdown inside the table to move work forward without opening a form.
        Filters cover project, status, priority, assignee, due date and sorting.
      </p>
    </div>
  );
}
