"use client";

import { LogOut, Settings, ShieldCheck, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { cn } from "@/lib/utils";

export function UserMenu({
  user,
  role,
  className,
}: {
  user: { name: string; email: string; avatarColor: string };
  role: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const result = await callAction("auth.logout");
    if (result.ok) {
      toast.success("Signed out", "See you soon!");
      router.replace("/login");
      router.refresh();
    } else {
      setSigningOut(false);
      toast.error("Could not sign out", result.error);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-surface p-0.5 pr-2.5 text-sm transition hover:bg-surface-muted",
          className,
        )}
        aria-label="Account menu"
      >
        <Avatar name={user.name} color={user.avatarColor} size="sm" />
        <span className="hidden max-w-28 truncate font-medium sm:inline">{user.name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Signed in</DropdownMenuLabel>
        <div className="flex items-center gap-3 px-2.5 pb-2">
          <Avatar name={user.name} color={user.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <ShieldCheck className="size-3" aria-hidden />
              {role.toLowerCase()}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserIcon className="size-4" aria-hidden />
            Profile & preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#workspace">
            <Settings className="size-4" aria-hidden />
            Workspace settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-xs font-medium text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={() => void signOut()} disabled={signingOut}>
          <LogOut className="size-4" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
