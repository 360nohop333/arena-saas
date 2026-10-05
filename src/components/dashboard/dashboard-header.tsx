import { CalendarDays, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  name,
  role,
  workspaceName,
  memberCount,
}: {
  name: string;
  role: string;
  workspaceName: string;
  memberCount: number;
}) {
  const today = new Date();

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}, {name} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is what is happening across <span className="font-medium text-foreground">{workspaceName}</span> today.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5 py-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1">
          <Users className="size-3.5" aria-hidden />
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant="primary" className="py-1 capitalize">
          {role.toLowerCase()}
        </Badge>
      </div>
    </div>
  );
}
