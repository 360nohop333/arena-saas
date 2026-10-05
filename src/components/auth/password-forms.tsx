"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";

export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await callAction<{ devResetUrl?: string }>("auth.forgotPassword", { email });
    setPending(false);

    if (result.ok) {
      setSent(result.message ?? "Check your inbox for the reset link.");
      setDevLink(result.data?.devResetUrl ?? null);
      toast.success("Reset requested");
      return;
    }

    setError(result.error);
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <Alert tone="success" title="Request received">
          {sent}
        </Alert>

        {devLink ? (
          <Alert tone="info" title="Development mode">
            No mail provider is configured, so here is your reset link:{" "}
            <Link href={devLink.replace(/^https?:\/\/[^/]+/, "")} className="font-semibold text-primary underline">
              open reset link
            </Link>
          </Alert>
        ) : null}

        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email you signed up with and we&apos;ll send a reset link.
        </p>
      </div>

      {error ? (
        <div role="alert">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="forgot-email" required>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending} loadingLabel="Sending…">
          Send reset link
        </Button>
      </form>

      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        ← Back to sign in
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const result = await callAction<{ redirectTo: string }>("auth.resetPassword", {
      token,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (result.ok) {
      toast.success("Password updated", result.message);
      router.replace("/login?reset=1");
      router.refresh();
      return;
    }

    setPending(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Reset links are single-use and expire after one hour.
        </p>
      </div>

      {error ? (
        <div role="alert">
          <Alert tone="danger" title="Could not reset password">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="reset-password" required error={fieldErrors.password}>
          <Input
            id="reset-password"
            type="password"
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="reset-confirm"
          required
          error={fieldErrors.confirmPassword}
        >
          <Input
            id="reset-confirm"
            type="password"
            value={values.confirmPassword}
            onChange={(event) =>
              setValues((current) => ({ ...current, confirmPassword: event.target.value }))
            }
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending} loadingLabel="Updating…">
          Update password
        </Button>
      </form>

      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        ← Back to sign in
      </Link>
    </div>
  );
}
