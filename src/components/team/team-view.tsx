"use client";

import {
  Check,
  Copy,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert, Avatar, EmptyState, Td, Th, TableWrapper } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { roleLabel } from "@/lib/utils";
import type { TeamData } from "@/server/actions/team";

const ROLE_VARIANTS: Record<Role, "primary" | "info" | "default"> = {
  OWNER: "primary",
  ADMIN: "info",
  MEMBER: "default",
};

export function TeamView({
  data,
  currentUserId,
  role,
  workspaceName,
  appUrl,
}: {
  data: TeamData;
  currentUserId: string;
  role: Role;
  workspaceName: string;
  appUrl: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [removing, setRemoving] = useState<TeamData["members"][number] | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  const canManage = role === "OWNER" || role === "ADMIN";

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Link copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy", "Copy the link manually from the field.");
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    setInviteError(null);

    const result = await callAction<{ acceptUrl: string }>("team.invite", {
      email: inviteEmail,
      role: inviteRole,
    });

    setInviting(false);

    if (result.ok) {
      toast.success("Invitation created", result.message);
      setLastInviteUrl(result.data?.acceptUrl ?? null);
      setInviteEmail("");
      router.refresh();
      return;
    }

    setInviteError(result.error);
    toast.error("Could not invite", result.error);
  }

  async function revokeInvite(inviteId: string) {
    const result = await callAction("team.revokeInvite", { inviteId });
    if (result.ok) {
      toast.success("Invitation revoked");
      router.refresh();
    } else {
      toast.error("Could not revoke", result.error);
    }
  }

  async function changeRole(membershipId: string, nextRole: Role) {
    const result = await callAction("team.changeRole", { memberId: membershipId, role: nextRole });
    if (result.ok) {
      toast.success(result.message ?? "Role updated");
      router.refresh();
    } else {
      toast.error("Could not change the role", result.error);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemovingBusy(true);
    const result = await callAction("team.remove", {
      memberId: removing.membershipId,
      reassignTo: null,
    });
    setRemovingBusy(false);
    setRemoving(null);

    if (result.ok) {
      toast.success(result.message ?? "Member removed");
      router.refresh();
    } else {
      toast.error("Could not remove the member", result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.members.length} member{data.members.length === 1 ? "" : "s"} in {workspaceName}
          {data.pendingInvites.length > 0
            ? ` · ${data.pendingInvites.length} pending invitation${data.pendingInvites.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <p className="text-sm text-muted-foreground">
              We generate a secure single-use invite link. Share it with your teammate — they sign up
              with the same email, then open the link to join.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteError ? <Alert tone="danger">{inviteError}</Alert> : null}

            <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
              <Field label="Email address" htmlFor="invite-email" required className="sm:col-span-1">
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  required
                />
              </Field>

              <Field label="Role" htmlFor="invite-role" required>
                <Select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as Role)}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>

              <div className="flex items-end">
                <Button type="submit" loading={inviting} loadingLabel="Creating…" className="w-full sm:w-auto">
                  <Mail aria-hidden />
                  Send invite
                </Button>
              </div>
            </form>

            {lastInviteUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface-muted/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Invite link
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={lastInviteUrl}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                    aria-label="Invite link"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void copy(lastInviteUrl, "last")}
                  >
                    {copied === "last" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Alert tone="info" title="Read-only team view">
          You need the Owner or Admin role to invite or remove teammates.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th className="hidden md:table-cell">Workload</Th>
                <Th className="hidden lg:table-cell">Joined</Th>
                <Th className="w-12">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.membershipId} className="transition hover:bg-surface-muted/50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} color={member.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.name}
                          {member.userId === currentUserId ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">you</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={ROLE_VARIANTS[member.role]}>
                      {member.role === "OWNER" ? (
                        <ShieldCheck className="size-3" aria-hidden />
                      ) : member.role === "ADMIN" ? (
                        <Shield className="size-3" aria-hidden />
                      ) : null}
                      {roleLabel(member.role)}
                    </Badge>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {member.openTasks} open · {member.doneTasks} done
                    </span>
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {member.joinedAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </Td>
                  <Td>
                    {canManage && member.role !== "OWNER" && member.userId !== currentUserId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                          aria-label={`Actions for ${member.name}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {member.role === "MEMBER" ? (
                            <DropdownMenuItem onSelect={() => void changeRole(member.membershipId, "ADMIN")}>
                              <UserCog className="size-4" aria-hidden />
                              Promote to Admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => void changeRole(member.membershipId, "MEMBER")}>
                              <UserCog className="size-4" aria-hidden />
                              Change to Member
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => setRemoving(member)}>
                            <Trash2 className="size-4" aria-hidden />
                            Remove from workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="sr-only">No actions available</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Invitations expire after 14 days. Copy a link to share it directly.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.pendingInvites.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Mail className="size-5" aria-hidden />}
                title="No pending invitations"
                description="Invite a teammate above and the link will appear here until it is accepted."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.pendingInvites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invite.role]} · invited{" "}
                      {invite.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·
                      expires{" "}
                      {invite.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copy(invite.acceptUrl, invite.id)}
                    >
                      {copied === invite.id ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      Copy link
                    </Button>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Revoke invitation for ${invite.email}`}
                        onClick={() => void revokeInvite(invite.id)}
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this member"}?`}
        description="They lose access to this workspace immediately. Their open tasks become unassigned — reassign them first if the work is in flight."
        confirmLabel="Remove member"
        destructive
        loading={removingBusy}
        onConfirm={() => void confirmRemove()}
      />

      <p className="text-xs text-muted-foreground">
        Invite links look like <code className="font-mono">{appUrl}/invite/…</code> and only work for
        the invited email address.
      </p>
    </div>
  );
}
