import { TeamView } from "@/components/team/team-view";
import { ErrorState } from "@/components/ui/misc";
import { serverEnv } from "@/lib/env";
import { getWorkspaceContext } from "@/lib/workspace";
import { getTeamData, type TeamData } from "@/server/actions/team";
import type { Role } from "@/lib/constants";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const context = await getWorkspaceContext();
  const result = await getTeamData();

  if (!result.ok || !result.data) {
    return (
      <ErrorState
        title="Could not load your team"
        description={result.ok ? "Unexpected empty response." : result.error}
      />
    );
  }

  const data: TeamData = result.data;

  return (
    <TeamView
      data={data}
      currentUserId={context.user.id}
      role={context.role as Role}
      workspaceName={context.workspace.name}
      appUrl={serverEnv().APP_URL}
    />
  );
}
