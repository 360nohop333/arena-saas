import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Alert } from "@/components/ui/misc";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Reset link missing</h1>
        <Alert tone="warning" title="No reset token">
          Open the link from your reset email, or request a new one.
        </Alert>
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
