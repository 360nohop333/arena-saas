import { SettingsView } from "@/components/settings/settings-view";
import { ErrorState } from "@/components/ui/misc";
import { getUserWorkspaces } from "@/lib/workspace";
import { getSettingsData, type SettingsData } from "@/server/actions/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [result, workspaces] = await Promise.all([getSettingsData(), getUserWorkspaces()]);

  if (!result.ok || !result.data) {
    return (
      <ErrorState
        title="Could not load your settings"
        description={result.ok ? "Unexpected empty response." : result.error}
      />
    );
  }

  const data: SettingsData = result.data;

  return <SettingsView data={data} workspaces={workspaces} />;
}
