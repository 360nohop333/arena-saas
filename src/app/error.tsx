"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Global error boundary — rendered when a server component throws.
 * The technical detail is only shown outside production.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[taskflow] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-danger/30 bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error interrupted this page. Your data is safe — try again, or head back to
          the dashboard.
        </p>

        {process.env.NODE_ENV !== "production" ? (
          <pre className="max-h-40 overflow-auto rounded-md bg-surface-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 text-sm font-semibold transition hover:bg-surface-muted"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
