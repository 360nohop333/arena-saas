"use client";

import { ErrorState } from "@/components/ui/misc";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This section failed to load"
      description={
        process.env.NODE_ENV === "production"
          ? "Please try again in a moment."
          : error.message
      }
      onRetry={reset}
      className="mt-6"
    />
  );
}
