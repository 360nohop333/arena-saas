"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";

export function AcceptInviteButton({
  token,
  workspaceName,
}: {
  token: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);

    const result = await callAction<{ redirectTo: string }>("auth.acceptInvite", { token });

    if (result.ok) {
      toast.success(result.message ?? "Welcome to the team!");
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    setError(result.error);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div role="alert">
          <Alert tone="danger" title="Could not accept the invitation">
            {error}
          </Alert>
        </div>
      ) : null}

      <Button size="lg" className="w-full" onClick={() => void accept()} loading={pending} loadingLabel="Joining…">
        Accept and open {workspaceName}
      </Button>
    </div>
  );
}
