import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FolderKanban,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

const FEATURES = [
  {
    icon: Bot,
    title: "AI project assistant",
    description:
      "Summarise any project, break a brief into tasks, get priority suggestions and surface blockers before they bite.",
  },
  {
    icon: FolderKanban,
    title: "Projects that stay on track",
    description:
      "Deadlines, status, live progress percentage and per-project membership with archive instead of delete.",
  },
  {
    icon: ListChecks,
    title: "Tasks that match reality",
    description:
      "Four statuses, four priorities, due dates, assignees, search plus rich filtering and sorting.",
  },
  {
    icon: Users,
    title: "Built for small teams",
    description:
      "Invite teammates, assign Owner/Admin/Member roles and see who is carrying the workload.",
  },
  {
    icon: BarChart3,
    title: "Productivity you can see",
    description:
      "Completion trend, status mix, workload distribution and a recent activity trail on the dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description:
      "Hashed passwords, database-backed sessions, server-side validation and workspace-scoped access on every query.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Sparkles className="size-4.5" aria-hidden />
            </span>
            <span className="text-sm font-bold">TaskFlow AI</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
            >
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            AI-powered project management for small teams
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Plan the work. Let AI handle the status updates.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            TaskFlow AI brings projects, tasks and teammates together — then summarises progress,
            breaks down briefs and flags overdue or blocked work automatically.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover sm:w-auto"
            >
              Create free account
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border-strong px-6 text-sm font-semibold transition hover:bg-surface-muted sm:w-auto"
            >
              Explore the demo workspace
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Demo login: <span className="font-mono">demo@taskflow.ai / Demo1234!</span>
          </p>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-20 grid items-center gap-10 rounded-2xl border border-border bg-surface p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              The demo workspace is already populated
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sign in to explore three live projects, twenty tasks across every priority and status,
              overdue work, a full activity feed and an AI assistant that analyses real data.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "3 projects with deadlines and members",
                "20 tasks — 4 priorities, 4 statuses, overdue work",
                "5 teammates with Owner/Admin/Member roles",
                "Activity trail and one-click AI analyses",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted/50 p-5 font-mono text-xs leading-relaxed">
            <p className="text-muted-foreground"># set up locally</p>
            <p>npm install</p>
            <p>cp .env.example .env</p>
            <p>npm run setup</p>
            <p>npm run dev</p>
            <p className="mt-3 text-muted-foreground"># then open</p>
            <p>http://localhost:3000</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        TaskFlow AI · Next.js + Drizzle ORM + SQLite · demo project
      </footer>
    </div>
  );
}
