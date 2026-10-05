"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";

export function LoginForm({ demoEmail, demoPassword }: { demoEmail: string; demoPassword: string }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const next = searchParams.get("next");
  const wasReset = searchParams.get("reset") === "1";

  useEffect(() => {
    if (wasReset) {
      toast.success("Password updated", "Sign in with your new password.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasReset]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const result = await callAction<{ redirectTo: string }>("auth.login", { email, password });

    if (result.ok) {
      toast.success("Welcome back", result.message);
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  function useDemo() {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to TaskFlow AI</h1>
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {wasReset ? (
        <Alert tone="success" title="Password updated">
          You can now sign in with your new password.
        </Alert>
      ) : null}

      {error ? (
        <div role="alert">
          <Alert tone="danger" title="Sign-in failed">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="login-email" required error={fieldErrors.email}>
          <Input
            id="login-email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" required error={fieldErrors.password}>
          <Input
            id="login-password"
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={pending} loadingLabel="Signing in…">
          Sign in
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-surface-muted/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Demo account
        </p>
        <p className="mt-1 font-mono text-xs">
          {demoEmail} / {demoPassword}
        </p>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={useDemo}>
          Fill demo credentials
        </Button>
      </div>
    </div>
  );
}
