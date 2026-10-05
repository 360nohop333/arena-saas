import { ProjectsView } from "@/components/projects/projects-view";
import { getWorkspaceContext } from "@/lib/workspace";
import { canDeleteProject } from "@/lib/permissions";
import { listProjects } from "@/server/queries";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const context = await getWorkspaceContext();
  const projects = await listProjects(context.workspace.id, { includeArchived: true });

  return (
    <ProjectsView
      projects={projects}
      members={context.members.map((member) => ({
        userId: member.userId,
        name: member.name,
        role: member.role,
        avatarColor: member.avatarColor,
      }))}
      currentUserId={context.user.id}
      canManage={canDeleteProject(context.role)}
    />
  );
}
