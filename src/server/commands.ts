import "server-only";

import {
  acceptInviteCommand,
  forgotPasswordCommand,
  loginCommand,
  logoutCommand,
  resetPasswordCommand,
  signupCommand,
} from "@/server/actions/auth";
import {
  getAiPanelData,
  runAssistantCommand,
} from "@/server/actions/ai";
import {
  createProjectCommand,
  deleteProjectCommand,
  setProjectArchivedCommand,
  setProjectMemberCommand,
  updateProjectCommand,
} from "@/server/actions/projects";
import {
  changePasswordCommand,
  createWorkspaceCommand,
  getSettingsData,
  switchWorkspaceCommand,
  updateNotificationsCommand,
  updateProfileCommand,
  updateThemeCommand,
  updateWorkspaceCommand,
} from "@/server/actions/settings";
import {
  bulkCreateTasksCommand,
  createTaskCommand,
  deleteTaskCommand,
  reassignTasksCommand,
  toggleTaskStatusCommand,
  updateTaskCommand,
} from "@/server/actions/tasks";
import {
  changeMemberRoleCommand,
  getTeamData,
  inviteMemberCommand,
  removeMemberCommand,
  revokeInviteCommand,
} from "@/server/actions/team";

/**
 * Single registry of every server command.
 *
 * Both consumers share it:
 *   • `src/app/api/actions/[name]/route.ts` — typed JSON endpoint used by the UI
 *   • any server component / server action that wants to call a command directly
 *
 * Every command validates its input with Zod, resolves the caller's workspace
 * (so a user can never touch another tenant's data) and returns an
 * `ActionResult` instead of throwing.
 */
export const commands = {
  // auth
  "auth.signup": signupCommand,
  "auth.login": loginCommand,
  "auth.logout": logoutCommand,
  "auth.forgotPassword": forgotPasswordCommand,
  "auth.resetPassword": resetPasswordCommand,
  "auth.acceptInvite": acceptInviteCommand,

  // projects
  "project.create": createProjectCommand,
  "project.update": updateProjectCommand,
  "project.archive": setProjectArchivedCommand,
  "project.delete": deleteProjectCommand,
  "project.setMember": setProjectMemberCommand,

  // tasks
  "task.create": createTaskCommand,
  "task.update": updateTaskCommand,
  "task.toggle": toggleTaskStatusCommand,
  "task.delete": deleteTaskCommand,
  "task.bulkCreate": bulkCreateTasksCommand,
  "task.reassign": reassignTasksCommand,

  // team
  "team.list": getTeamData,
  "team.invite": inviteMemberCommand,
  "team.revokeInvite": revokeInviteCommand,
  "team.changeRole": changeMemberRoleCommand,
  "team.remove": removeMemberCommand,

  // settings / workspace
  "settings.get": getSettingsData,
  "settings.updateProfile": updateProfileCommand,
  "settings.changePassword": changePasswordCommand,
  "settings.updateNotifications": updateNotificationsCommand,
  "settings.updateTheme": updateThemeCommand,
  "settings.updateWorkspace": updateWorkspaceCommand,
  "workspace.switch": switchWorkspaceCommand,
  "workspace.create": createWorkspaceCommand,

  // ai assistant
  "ai.panel": getAiPanelData,
  "ai.run": runAssistantCommand,
} as const;

export type CommandName = keyof typeof commands;

/** Commands that do not require an authenticated workspace. */
export const PUBLIC_COMMANDS: CommandName[] = [
  "auth.signup",
  "auth.login",
  "auth.forgotPassword",
  "auth.resetPassword",
  "auth.acceptInvite",
];

export function isCommandName(value: string): value is CommandName {
  return Object.prototype.hasOwnProperty.call(commands, value);
}
