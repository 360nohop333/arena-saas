import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-5xl font-bold text-primary">404</p>
        <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="text-sm text-muted-foreground">
          The page may have been moved, or the project or task was deleted.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
          >
            Back to dashboard
          </Link>
          <Link
            href="/tasks"
            className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 text-sm font-semibold transition hover:bg-surface-muted"
          >
            Go to tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
