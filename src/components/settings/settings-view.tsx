"use client";

import { Bell, Building2, KeyRound, Palette, Save, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import type { SettingsData } from "@/server/actions/settings";

type Result = { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string[]> };

function useSectionForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<string | null>(null);

  return {
    pending,
    error,
    fieldErrors,
    saved,
    setSaved,
    async run(action: () => Promise<Result>, successMessage: string) {
      setPending(true);
      setError(null);
      setFieldErrors({});
      setSaved(null);

      const result = await action();
      setPending(false);

      if (result.ok) {
        setSaved(successMessage);
        return true;
      }

      setError(result.error ?? "Something went wrong.");
      setFieldErrors(result.fieldErrors ?? {});
      return false;
    },
  };
}

export function SettingsView({
  data,
  workspaces,
}: {
  data: SettingsData;
  workspaces: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState({
    name: data.profile.name,
    email: data.profile.email,
    jobTitle: data.profile.jobTitle ?? "",
    timezone: data.profile.timezone,
  });
  const profileForm = useSectionForm();

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const passwordForm = useSectionForm();

  const [workspaceName, setWorkspaceName] = useState(data.workspace.name);
  const workspaceForm = useSectionForm();

  const [notifications, setNotifications] = useState(data.notifications);
  const notificationsForm = useSectionForm();

  const canManageWorkspace = data.workspace.role === "OWNER" || data.workspace.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, workspace, notifications and appearance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Profile */}
          <Card id="profile">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="size-4 text-muted-foreground" aria-hidden />
                Profile
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                This is how teammates see you across the workspace.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ok = await profileForm.run(
                    () => callAction("settings.updateProfile", profile),
                    "Profile updated.",
                  );
                  if (ok) {
                    toast.success("Profile updated");
                    router.refresh();
                  } else {
                    toast.error("Could not save profile");
                  }
                }}
              >
                {profileForm.error ? <Alert tone="danger">{profileForm.error}</Alert> : null}
                {profileForm.saved ? <Alert tone="success">{profileForm.saved}</Alert> : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="profile-name" required error={profileForm.fieldErrors.name}>
                    <Input
                      id="profile-name"
                      value={profile.name}
                      onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                      required
                      minLength={2}
                    />
                  </Field>

                  <Field label="Email" htmlFor="profile-email" required error={profileForm.fieldErrors.email}>
                    <Input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                      required
                    />
                  </Field>

                  <Field label="Job title" htmlFor="profile-title" error={profileForm.fieldErrors.jobTitle}>
                    <Input
                      id="profile-title"
                      value={profile.jobTitle}
                      onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value })}
                      placeholder="Product Manager"
                      maxLength={80}
                    />
                  </Field>

                  <Field
                    label="Timezone"
                    htmlFor="profile-timezone"
                    error={profileForm.fieldErrors.timezone}
                    hint="Used for due-date reminders."
                  >
                    <Input
                      id="profile-timezone"
                      value={profile.timezone}
                      onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}
                      placeholder="Europe/London"
                      maxLength={60}
                    />
                  </Field>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" loading={profileForm.pending} loadingLabel="Saving…">
                    <Save aria-hidden />
                    Save profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Password */}
          <Card id="password">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                Password
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Changing your password signs out every other device.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ok = await passwordForm.run(
                    () => callAction("settings.changePassword", passwords),
                    "Password changed. Other devices were signed out.",
                  );
                  if (ok) {
                    toast.success("Password changed");
                    setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  } else {
                    toast.error("Could not change password");
                  }
                }}
              >
                {passwordForm.error ? <Alert tone="danger">{passwordForm.error}</Alert> : null}
                {passwordForm.saved ? <Alert tone="success">{passwordForm.saved}</Alert> : null}

                <Field
                  label="Current password"
                  htmlFor="current-password"
                  required
                  error={passwordForm.fieldErrors.currentPassword}
                >
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, currentPassword: event.target.value })
                    }
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="New password"
                    htmlFor="new-password"
                    required
                    error={passwordForm.fieldErrors.newPassword}
                    hint="At least 8 characters with a letter and a number."
                  >
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwords.newPassword}
                      onChange={(event) =>
                        setPasswords({ ...passwords, newPassword: event.target.value })
                      }
                      required
                      minLength={8}
                    />
                  </Field>

                  <Field
                    label="Confirm new password"
                    htmlFor="confirm-password"
                    required
                    error={passwordForm.fieldErrors.confirmPassword}
                  >
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwords.confirmPassword}
                      onChange={(event) =>
                        setPasswords({ ...passwords, confirmPassword: event.target.value })
                      }
                      required
                    />
                  </Field>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" loading={passwordForm.pending} loadingLabel="Updating…">
                    Update password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card id="notifications">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" aria-hidden />
                Notification preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose what TaskFlow should tell you about. Preferences are stored on your account.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ok = await notificationsForm.run(
                    () => callAction("settings.updateNotifications", notifications),
                    "Preferences saved.",
                  );
                  if (ok) toast.success("Preferences saved");
                  else toast.error("Could not save preferences");
                }}
              >
                {notificationsForm.error ? <Alert tone="danger">{notificationsForm.error}</Alert> : null}

                {(
                  [
                    ["dueDateReminders", "Due date reminders", "A daily digest of tasks due today and overdue."],
                    ["emailNotifications", "Email notifications", "Assignments, mentions and invitations."],
                    ["weeklyDigest", "Weekly progress digest", "A Monday summary of workspace throughput."],
                    ["pushNotifications", "Browser notifications", "Real-time alerts while TaskFlow is open."],
                  ] as const
                ).map(([key, label, description]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-3 transition hover:bg-surface-muted/60"
                  >
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">{description}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={notifications[key]}
                      onChange={(event) =>
                        setNotifications({ ...notifications, [key]: event.target.checked })
                      }
                      className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                      aria-label={label}
                    />
                  </label>
                ))}

                <div className="flex justify-end">
                  <Button type="submit" loading={notificationsForm.pending} loadingLabel="Saving…">
                    Save preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card id="appearance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-4 text-muted-foreground" aria-hidden />
                Appearance
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Light, dark or follow your system setting. Saved to your profile.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ThemeToggle className="w-full justify-between" />
              <p className="text-xs text-muted-foreground">
                Current preference: <strong>{data.theme}</strong>
              </p>
            </CardContent>
          </Card>

          <Card id="workspace">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" aria-hidden />
                Workspace
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} available to you.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your role</span>
                <Badge variant="primary">{ROLE_LABELS[data.workspace.role as Role]}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <Badge variant="outline">{data.workspace.plan}</Badge>
              </div>

              <form
                className="space-y-3 border-t border-border pt-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ok = await workspaceForm.run(
                    () => callAction("settings.updateWorkspace", { name: workspaceName }),
                    "Workspace updated.",
                  );
                  if (ok) {
                    toast.success("Workspace updated");
                    router.refresh();
                  } else {
                    toast.error("Could not update the workspace");
                  }
                }}
              >
                {workspaceForm.error ? <Alert tone="danger">{workspaceForm.error}</Alert> : null}

                <Field label="Workspace name" htmlFor="workspace-name" required error={workspaceForm.fieldErrors.name}>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    disabled={!canManageWorkspace}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </Field>

                {canManageWorkspace ? (
                  <Button type="submit" className="w-full" loading={workspaceForm.pending}>
                    Save workspace
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only owners and admins can rename the workspace.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">
                  {data.profile.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono text-xs text-muted-foreground">{data.profile.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
