import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Spinner } from "@/components/ui/misc";
import { serverEnv } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const env = serverEnv();

  return (
    <Suspense fallback={<Spinner label="Loading sign-in…" />}>
      <LoginForm demoEmail={env.DEMO_EMAIL} demoPassword={env.DEMO_PASSWORD} />
    </Suspense>
  );
}
