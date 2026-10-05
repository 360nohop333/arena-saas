import {
  AlarmClock,
  CheckCircle2,
  FolderKanban,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  ActivityFeed,
  MiniTaskList,
  PriorityBreakdown,
  ProductivityChart,
  ProjectProgressList,
  StatCard,
  StatusBreakdown,
  WorkloadList,
} from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getWorkspaceContext } from "@/lib/workspace";
import { getDashboardData } from "@/server/queries";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const context = await getWorkspaceContext();
  const data = await getDashboardData(context.workspace.id, context.user.id);

  const { stats, productivity } = data;
  const firstName = context.user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <DashboardHeader
        name={firstName}
        role={context.role}
        workspaceName={context.workspace.name}
        memberCount={data.memberCount}
      />

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={data.projectCount}
          hint={data.archivedCount > 0 ? `${data.archivedCount} archived` : "All projects active"}
          icon={FolderKanban}
          href="/projects"
          tone="primary"
        />
        <StatCard
          label="Total tasks"
          value={stats.total}
          hint={`${stats.open} open · ${stats.dueToday} due today`}
          icon={ListChecks}
          href="/tasks"
        />
        <StatCard
          label="Completed"
          value={stats.done}
          hint={`${stats.completionRate}% completion rate`}
          icon={CheckCircle2}
          tone="success"
          trend={{
            value:
              productivity.completedPrevious7Days === 0
                ? productivity.completedLast7Days > 0
                  ? 100
                  : 0
                : Math.round(
                    ((productivity.completedLast7Days - productivity.completedPrevious7Days) /
                      productivity.completedPrevious7Days) *
                      100,
                  ),
            label: "vs last week",
          }}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint={stats.overdue === 0 ? "Nothing past due 🎉" : "Needs attention today"}
          icon={AlarmClock}
          href="/tasks?due=overdue"
          tone={stats.overdue > 0 ? "danger" : "success"}
        />
      </section>

      {stats.total === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" aria-hidden />}
          title="Your workspace is ready for its first project"
          description="Create a project, add a few tasks and the AI assistant will start summarising progress and flagging blockers."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/projects">
                  <Plus aria-hidden />
                  Create a project
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/tasks">Go to tasks</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ProductivityChart
                trend={productivity.trend}
                completedLast7Days={productivity.completedLast7Days}
                completedPrevious7Days={productivity.completedPrevious7Days}
              />
            </div>
            <StatusBreakdown byStatus={productivity.byStatus} total={stats.total} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ProjectProgressList
              projects={data.projects.map((project) => ({
                id: project.id,
                name: project.name,
                color: project.color,
                progress: project.progress,
                taskCount: project.taskCount,
                doneCount: project.doneCount,
                overdueCount: project.overdueCount,
                daysToDeadline: project.daysToDeadline,
                members: project.memberIds
                  .map((userId) => context.members.find((member) => member.userId === userId))
                  .filter((member): member is NonNullable<typeof member> => Boolean(member))
                  .map((member) => ({ name: member.name, color: member.avatarColor })),
              }))}
            />
            <MiniTaskList
              title="My tasks"
              description="Assigned to you, ordered by due date"
              tasks={data.myTasks}
              emptyMessage="Nothing assigned to you right now."
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/tasks?assigneeId=${context.user.id}`}>View all</Link>
                </Button>
              }
            />
            <MiniTaskList
              title="Upcoming deadlines"
              description="Next five due dates across the workspace"
              tasks={data.upcoming}
              emptyMessage="No upcoming due dates."
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/tasks?due=week">This week</Link>
                </Button>
              }
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivityFeed items={data.activity} />
            </div>
            <div className="space-y-4">
              <WorkloadList workload={productivity.workload} />
              <PriorityBreakdown byPriority={productivity.byPriority} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
