"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { cn } from "@/lib/utils";

export function ProjectMembersCard({
  projectId,
  projectMembers,
  workspaceMembers,
}: {
  projectId: string;
  projectMembers: { userId: string; name: string; color: string; email: string; jobTitle: string | null }[];
  workspaceMembers: { userId: string; name: string; color: string; role: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberIds = new Set(projectMembers.map((member) => member.userId));
  const available = workspaceMembers.filter((member) => !memberIds.has(member.userId));

  async function setMembership(userId: string, member: boolean) {
    setBusyId(userId);
    const result = await callAction("project.setMember", { projectId, userId, member });
    setBusyId(null);

    if (result.ok) {
      toast.success(member ? "Added to project" : "Removed from project");
      router.refresh();
    } else {
      toast.error("Could not update project members", result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project members</CardTitle>
        <p className="text-sm text-muted-foreground">
          Only members appear as assignees in this project.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {projectMembers.map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.name} color={member.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.jobTitle ?? member.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${member.name} from this project`}
                disabled={busyId === member.userId}
                onClick={() => void setMembership(member.userId, false)}
                className="text-muted-foreground hover:text-danger"
              >
                <UserMinus className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>

        {available.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add from workspace
            </p>
            <ul className="space-y-2">
              {available.map((member) => (
                <li key={member.userId} className="flex items-center gap-3">
                  <Avatar name={member.name} color={member.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role.toLowerCase()}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === member.userId}
                    onClick={() => void setMembership(member.userId, true)}
                  >
                    <UserPlus className="size-3.5" aria-hidden />
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Everyone in the workspace is already on this project.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectMetaCard({
  status,
  progress,
  taskCount,
  doneCount,
  overdueCount,
  deadline,
  createdAt,
}: {
  status: string;
  progress: number;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  deadline: Date | null;
  createdAt: Date;
}) {
  const rows: { label: string; value: string; tone?: "danger" | "success" }[] = [
    { label: "Status", value: status.replace("_", " ").toLowerCase() },
    { label: "Progress", value: `${progress}%` },
    { label: "Tasks", value: `${doneCount}/${taskCount} complete` },
    {
      label: "Overdue",
      value: String(overdueCount),
      tone: overdueCount > 0 ? "danger" : "success",
    },
    {
      label: "Deadline",
      value: deadline
        ? deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "Not set",
    },
    {
      label: "Created",
      value: createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "font-medium capitalize",
                  row.tone === "danger" && "text-danger",
                  row.tone === "success" && "text-success",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {overdueCount > 0 ? (
          <Badge variant="danger" className="mt-4 w-full justify-center py-1">
            {overdueCount} task{overdueCount === 1 ? "" : "s"} need attention
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
