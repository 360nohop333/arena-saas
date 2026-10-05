import { eq } from "drizzle-orm";
import { CalendarClock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { Alert } from "@/components/ui/misc";
import { db } from "@/db";
import { invites, users, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS, type Role } from "@/lib/constants";

export const metadata = { title: "Team invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [invite] = await db
    .select({
      email: invites.email,
      role: invites.role,
      status: invites.status,
      expiresAt: invites.expiresAt,
      workspaceName: workspaces.name,
      inviterName: users.name,
    })
    .from(invites)
    .innerJoin(workspaces, eq(invites.workspaceId, workspaces.id))
    .innerJoin(users, eq(invites.invitedById, users.id))
    .where(eq(invites.token, token))
    .limit(1);

  const currentUser = await getCurrentUser();

  if (!invite) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Invitation not found</h1>
        <Alert tone="danger" title="Invalid link">
          This invitation link is invalid or has been removed. Ask a workspace admin to send a new
          one.
        </Alert>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  const expired = invite.expiresAt.getTime() < Date.now();
  const used = invite.status === "ACCEPTED";
  const revoked = invite.status === "REVOKED";
  const emailMatches = currentUser?.email === invite.email;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Join {invite.workspaceName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {invite.inviterName} invited you to collaborate on TaskFlow AI.
        </p>
      </div>

      <dl className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-4 text-sm">
        <div className="flex items-center gap-3">
          <Mail className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Invited email</dt>
            <dd className="font-medium">{invite.email}</dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="font-medium">{ROLE_LABELS[invite.role as Role] ?? invite.role}</dd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Expires</dt>
            <dd className="font-medium">
              {invite.expiresAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        </div>
      </dl>

      {used ? (
        <Alert tone="info" title="Already accepted">
          This invitation has already been used.{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>{" "}
          to open the workspace.
        </Alert>
      ) : revoked ? (
        <Alert tone="danger" title="Invitation revoked">
          An admin revoked this invitation.
        </Alert>
      ) : expired ? (
        <Alert tone="warning" title="Invitation expired">
          Ask an admin to send a fresh invitation.
        </Alert>
      ) : !currentUser ? (
        <div className="space-y-3">
          <Alert tone="info" title="Sign in to accept">
            Sign in (or create an account) with <strong>{invite.email}</strong>, then open this link
            again.
          </Alert>
          <div className="flex gap-2">
            <Link
              href={`/login?next=/invite/${token}`}
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 text-sm font-semibold transition hover:bg-surface-muted"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : !emailMatches ? (
        <Alert tone="warning" title="Wrong account">
          You are signed in as <strong>{currentUser.email}</strong>, but this invitation is for{" "}
          <strong>{invite.email}</strong>. Sign in with the invited address to accept.
        </Alert>
      ) : (
        <AcceptInviteButton token={token} workspaceName={invite.workspaceName} />
      )}
    </div>
  );
}
