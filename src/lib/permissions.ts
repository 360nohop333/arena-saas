import type { Role } from "@/lib/constants";
import { WORKSPACE_ROLE_RANK } from "@/lib/constants";

/** Administrative workspace actions (invite, remove member, edit workspace). */
export function canManageWorkspace(role: Role | string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Only the owner can delete the workspace or transfer ownership. */
export function canDeleteWorkspace(role: Role | string): boolean {
  return role === "OWNER";
}

/** Admins may manage the workspace, but may not demote/remove the owner. */
export function canManageMember(actorRole: Role | string, targetRole: Role | string): boolean {
  if (!canManageWorkspace(actorRole)) return false;
  if (targetRole === "OWNER") return false;
  if (actorRole === "ADMIN" && targetRole === "ADMIN") return false;
  return WORKSPACE_ROLE_RANK[actorRole as Role] > WORKSPACE_ROLE_RANK[targetRole as Role];
}

/** Deleting a project is destructive — admins and owners only. */
export function canDeleteProject(role: Role | string): boolean {
  return canManageWorkspace(role);
}
