"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";

export function WorkspaceSwitcher({
  workspace,
  workspaces,
}: {
  workspace: { id: string; name: string; plan: string };
  workspaces: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(workspaceId: string) {
    if (workspaceId === workspace.id) return;
    const result = await callAction("workspace.switch", { workspaceId });
    if (result.ok) {
      toast.success("Workspace switched");
      router.refresh();
    } else {
      toast.error("Could not switch workspace", result.error);
    }
  }

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await callAction("workspace.create", { name });
    setPending(false);

    if (result.ok) {
      toast.success(result.message ?? "Workspace created");
      setCreateOpen(false);
      setName("");
      router.refresh();
      return;
    }
    setError(result.error);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition hover:bg-surface-muted"
          aria-label="Switch workspace"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {workspace.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{workspace.name}</span>
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
              {workspace.plan} plan
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => void switchTo(item.id)}>
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.id === workspace.id ? <Check className="size-4 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPrimitive.Root open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-90 bg-slate-950/45 backdrop-blur-sm animate-[var(--animate-overlay-in)]" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-100 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-popover)] animate-[var(--animate-slide-up)]">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Create a workspace
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Workspaces keep projects, tasks and teammates separated — great for separate clients or
              side projects.
            </DialogPrimitive.Description>

            <form onSubmit={createWorkspace} className="mt-5 space-y-4">
              {error ? (
                <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <Field label="Workspace name" htmlFor="new-workspace-name" required>
                <Input
                  id="new-workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Acme Studio"
                  minLength={2}
                  maxLength={80}
                  required
                  autoFocus
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending} loadingLabel="Creating…">
                  Create workspace
                </Button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
