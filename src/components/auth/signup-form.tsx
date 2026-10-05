"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    workspaceName: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  const update = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const result = await callAction<{ redirectTo: string }>("auth.signup", values);

    if (result.ok) {
      toast.success("Account created", result.message ?? "Welcome to TaskFlow AI!");
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  const barColors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {error ? (
        <div role="alert">
          <Alert tone="danger" title="Could not create your account">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="signup-name" required error={fieldErrors.name}>
          <Input
            id="signup-name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="name"
            placeholder="Alex Morgan"
            required
            minLength={2}
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.name)}
          />
        </Field>

        <Field label="Work email" htmlFor="signup-email" required error={fieldErrors.email}>
          <Input
            id="signup-email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="signup-password"
          required
          error={fieldErrors.password}
          hint="At least 8 characters with a letter and a number."
        >
          <Input
            id="signup-password"
            type="password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={8}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {values.password ? (
            <div className="mt-1 space-y-1">
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      index < strength.score ? barColors[strength.score] : "bg-surface-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {strength.label}
                {strength.problems.length > 0 ? ` — ${strength.problems[0]}` : ""}
              </p>
            </div>
          ) : null}
        </Field>

        <Field
          label="Workspace name"
          htmlFor="signup-workspace"
          error={fieldErrors.workspaceName}
          hint="Optional — we will create one for you."
        >
          <Input
            id="signup-workspace"
            value={values.workspaceName}
            onChange={(event) => update("workspaceName", event.target.value)}
            placeholder="Acme Studio"
            maxLength={80}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending} loadingLabel="Creating account…">
          Create account
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the demo terms of service.
        </p>
      </form>
    </div>
  );
}
