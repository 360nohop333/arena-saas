import { AppShell } from "@/components/layout/app-shell";
import { getProjectOptions } from "@/server/queries";
import { getWorkspaceContext, getUserWorkspaces } from "@/lib/workspace";

/**
 * Authenticated application shell.
 *
 * `getWorkspaceContext()` redirects to /login when there is no valid session —
 * this is the single protection point for every page in the (app) group.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // getWorkspaceContext() resolves (and protects) the session first, then the
  // sidebar data is scoped to that workspace.
  const [context, workspaces] = await Promise.all([getWorkspaceContext(), getUserWorkspaces()]);
  const scopedProjects = await getProjectOptions(context.workspace.id);

  return (
    <AppShell
      user={{
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        avatarColor: context.user.avatarColor,
        jobTitle: context.user.jobTitle,
      }}
      workspace={{
        id: context.workspace.id,
        name: context.workspace.name,
        plan: context.workspace.plan,
      }}
      workspaces={workspaces}
      role={context.role}
      projects={scopedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
      }))}
      members={context.members.map((member) => ({
        userId: member.userId,
        name: member.name,
      }))}
    >
      {children}
    </AppShell>
  );
}
