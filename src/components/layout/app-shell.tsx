"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { ThemeIconToggle } from "@/components/theme-toggle";
import { TaskDialog, type MemberOption, type ProjectOption } from "@/components/tasks/task-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  user: { id: string; name: string; email: string; avatarColor: string; jobTitle: string | null };
  workspace: { id: string; name: string; plan: string };
  workspaces: { id: string; name: string; role: string }[];
  role: string;
  projects: ProjectOption[];
  members: MemberOption[];
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-accent text-primary shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  user,
  workspace,
  workspaces,
  projects,
  members,
  role,
  onNavigate,
}: Omit<AppShellProps, "children"> & { onNavigate?: () => void }) {
  const [taskOpen, setTaskOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 px-1">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-bold leading-tight">TaskFlow AI</span>
          <span className="block text-[11px] text-muted-foreground">Projects on autopilot</span>
        </span>
      </Link>

      <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />

      <Button onClick={() => setTaskOpen(true)} className="w-full" size="md">
        <Plus aria-hidden />
        New task
      </Button>

      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        {projects.length > 0 ? (
          <div className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Projects
            </p>
            <ul className="space-y-0.5">
              {projects.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
          <p className="text-xs font-semibold">Signed in as</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {user.email} · {role.toLowerCase()}
          </p>
        </div>
      </div>

      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        projects={projects}
        members={members}
      />
    </div>
  );
}

export function AppShell({
  user,
  workspace,
  workspaces,
  role,
  projects,
  members,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[268px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface lg:block">
        <SidebarBody
          user={user}
          workspace={workspace}
          workspaces={workspaces}
          projects={projects}
          members={members}
          role={role}
        />
      </aside>

      {/* Mobile sidebar */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-90 bg-slate-950/50 backdrop-blur-sm lg:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-100 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-surface shadow-[var(--shadow-popover)] lg:hidden"
            aria-label="Navigation"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Main navigation for TaskFlow AI
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted"
              aria-label="Close navigation"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
            <SidebarBody
              user={user}
              workspace={workspace}
              workspaces={workspaces}
              projects={projects}
              members={members}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-surface-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" aria-hidden />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-bold">TaskFlow AI</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/tasks?due=overdue"
                className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground sm:inline-flex"
              >
                Overdue
              </Link>
              <ThemeIconToggle />
              <UserMenu user={user} role={role} />
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
            <span>TaskFlow AI — demo workspace “{workspace.name}”</span>
            <span>Built with Next.js, Drizzle ORM and SQLite</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
