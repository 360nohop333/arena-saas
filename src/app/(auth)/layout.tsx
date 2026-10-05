import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const HIGHLIGHTS = [
  "Every project, task and deadline in one workspace",
  "AI summaries, task breakdowns and blocker detection",
  "Roles, invitations and a full activity trail",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-fuchsia-400/20 blur-3xl"
        />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold">TaskFlow AI</span>
        </Link>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-balance">
            Ship projects faster with an AI copilot for your team.
          </h1>
          <p className="text-white/80">
            TaskFlow AI keeps small teams aligned — and tells you what to do next before deadlines
            slip.
          </p>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-white/90">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Demo workspace included — 3 projects, 20 tasks, 5 teammates.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
