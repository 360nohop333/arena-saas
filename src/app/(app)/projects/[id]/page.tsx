import { eq } from "drizzle-orm";
import { Activity as ActivityIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { relativeTime } from "@/components/dashboard/widgets";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectMembersCard, ProjectMetaCard } from "@/components/projects/project-sidebar";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { activities, projects, users } from "@/db/schema";
import { canDeleteProject } from "@/lib/permissions";
import { getWorkspaceContext } from "@/lib/workspace";
import { loadAiPanel } from "@/server/ai-panel";
import { getProjectOptions, listProjectTasks, listProjects } from "@/server/queries";
import type { ActivityItem } from "@/lib/activity";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  const [project] = await db
    .select({ name: projects.name, workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (project && project.workspaceId !== context.workspace.id) return { title: "Project" };

  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getWorkspaceContext();

  const allProjects = await listProjects(context.workspace.id, { includeArchived: true });
  const summary = allProjects.find((project) => project.id === id);
  if (!summary) notFound();

  const [tasks, projectOptions, aiPanel, activityRows] = await Promise.all([
    listProjectTasks(id),
    getProjectOptions(context.workspace.id),
    loadAiPanel(context.workspace.id, id, context.user.id),
    db
      .select({
        id: activities.id,
        type: activities.type,
        message: activities.message,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
        projectId: activities.projectId,
        actorName: users.name,
        actorColor: users.avatarColor,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(eq(activities.projectId, id))
      .limit(12),
  ]);

  const activity: ActivityItem[] = [...activityRows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      createdAt: row.createdAt,
      projectId: row.projectId,
      projectName: summary.name,
      actorName: row.actorName,
      actorColor: row.actorColor,
      metadata: {},
    }));

  const workspaceMembers = context.members.map((member) => ({
    userId: member.userId,
    name: member.name,
    color: member.avatarColor,
    role: member.role,
  }));

  const projectMembers = summary.memberIds
    .map((userId) => context.members.find((member) => member.userId === userId))
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      color: member.avatarColor,
      email: member.email,
      jobTitle: member.title,
    }));

  const taskMemberOptions = projectMembers.length > 0
    ? projectMembers.map((member) => ({ userId: member.userId, name: member.name }))
    : workspaceMembers.map((member) => ({ userId: member.userId, name: member.name }));

  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const doneTasks = tasks.filter((task) => task.status === "DONE");

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={summary}
        members={workspaceMembers}
        projectMembers={projectMembers}
        currentUserId={context.user.id}
        canManage={canDeleteProject(context.role)}
        projects={projectOptions}
        allMembers={workspaceMembers.map((member) => ({ userId: member.userId, name: member.name }))}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <AiAssistantPanel
            projectId={summary.id}
            projectName={summary.name}
            projectDescription={summary.description ?? ""}
            initialData={aiPanel}
          />

          <Tabs defaultValue="open">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList aria-label="Task views">
                <TabsTrigger value="open">Open ({openTasks.length})</TabsTrigger>
                <TabsTrigger value="done">Done ({doneTasks.length})</TabsTrigger>
                <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="open">
              <Card>
                <CardContent className="p-0">
                  <TaskList
                    tasks={openTasks}
                    members={taskMemberOptions}
                    projects={projectOptions}
                    showProject={false}
                    emptyTitle="No open tasks"
                    emptyDescription="Everything in this project is complete. Add the next piece of work when you're ready."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="done">
              <Card>
                <CardContent className="p-0">
                  <TaskList
                    tasks={doneTasks}
                    members={taskMemberOptions}
                    projects={projectOptions}
                    showProject={false}
                    emptyTitle="Nothing completed yet"
                    emptyDescription="Completed tasks will collect here."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardContent className="p-0">
                  <TaskList
                    tasks={tasks}
                    members={taskMemberOptions}
                    projects={projectOptions}
                    showProject={false}
                    emptyTitle="No tasks yet"
                    emptyDescription="Use “Add task”, or ask the AI assistant to break the brief down for you."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <ProjectMetaCard
            status={summary.status}
            progress={summary.progress}
            taskCount={summary.taskCount}
            doneCount={summary.doneCount}
            overdueCount={summary.overdueCount}
            deadline={summary.deadline}
            createdAt={summary.createdAt}
          />

          <ProjectMembersCard
            projectId={summary.id}
            projectMembers={projectMembers}
            workspaceMembers={workspaceMembers.filter((member) => !summary.memberIds.includes(member.userId))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="size-4 text-muted-foreground" aria-hidden />
                Project activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No activity recorded for this project yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {activity.slice(0, 8).map((item) => (
                    <li key={item.id} className="text-sm">
                      <p>
                        <span className="font-medium">{item.actorName ?? "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{item.message}</span>
                      </p>
                      <time
                        dateTime={item.createdAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {relativeTime(item.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
