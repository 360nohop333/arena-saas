"use client";

import {
  AlertTriangle,
  Bot,
  CheckCheck,
  ClipboardList,
  Gauge,
  History,
  ListTree,
  Loader2,
  Rocket,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Markdown } from "@/components/ai/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Alert, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { callAction } from "@/lib/client-action";
import type { AiResponse } from "@/lib/ai/engine";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";
import { cn, priorityLabel } from "@/lib/utils";
import type { AiPanelData } from "@/server/ai-panel";

type AiKind = "summary" | "breakdown" | "priorities" | "risks" | "report";

const ACTIONS: {
  kind: AiKind;
  label: string;
  hint: string;
  icon: typeof Bot;
}[] = [
  { kind: "summary", label: "Summarise project", hint: "Where things stand right now", icon: Bot },
  { kind: "breakdown", label: "Break down a brief", hint: "Turn a description into tasks", icon: ListTree },
  { kind: "priorities", label: "Suggest priorities", hint: "Re-rank open work by risk", icon: Gauge },
  { kind: "risks", label: "Find risks & blockers", hint: "Overdue, stalled, blocked", icon: ShieldAlert },
  { kind: "report", label: "Status report", hint: "Shareable weekly update", icon: ClipboardList },
];

const RISK_TONES: Record<string, "danger" | "warning" | "info" | "default"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "default",
};

export function AiAssistantPanel({
  projectId,
  projectName,
  projectDescription,
  initialData,
}: {
  projectId: string;
  projectName: string;
  projectDescription: string;
  initialData: AiPanelData;
}) {
  const router = useRouter();
  const toast = useToast();

  const [result, setResult] = useState<AiResponse | null>(initialData.history[0]?.output ?? null);
  const [running, setRunning] = useState<AiKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState(projectDescription);
  const [showHistory, setShowHistory] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [appliedPriorities, setAppliedPriorities] = useState<Record<string, Priority>>({});

  async function run(kind: AiKind) {
    setRunning(kind);
    setError(null);

    const response = await callAction<{ result: AiResponse }>("ai.run", {
      projectId,
      kind,
      prompt: kind === "breakdown" ? brief : "",
    });

    setRunning(null);

    if (!response.ok) {
      setError(response.error);
      toast.error("The assistant could not finish", response.error);
      return;
    }

    const nextResult = response.data?.result ?? null;
    setResult(nextResult);
    setSelected(
      Object.fromEntries((nextResult?.suggestions ?? []).map((_, index) => [index, true])),
    );
    toast.success("Analysis complete", `${nextResult?.title ?? ""}`);
  }

  async function addSuggestedTasks() {
    const suggestions = (result?.suggestions ?? []).filter((_, index) => selected[index] !== false);
    if (suggestions.length === 0) {
      toast.warning("Nothing selected", "Tick at least one task to add.");
      return;
    }

    setApplying(true);
    const response = await callAction<{ created: number }>("task.bulkCreate", {
      projectId,
      tasks: suggestions.map((suggestion) => ({
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        dueInDays: suggestion.dueInDays,
      })),
    });
    setApplying(false);

    if (response.ok) {
      toast.success(`Added ${response.data?.created ?? 0} task(s)`, "They are now in the project backlog.");
      setResult(null);
      router.refresh();
    } else {
      toast.error("Could not add the tasks", response.error);
    }
  }

  async function applyPriority(taskId: string, priority: Priority) {
    const response = await callAction("task.update", { id: taskId, priority });
    if (response.ok) {
      setAppliedPriorities((current) => ({ ...current, [taskId]: priority }));
      toast.success("Priority updated", `Task set to ${PRIORITY_LABELS[priority]}.`);
      router.refresh();
    } else {
      toast.error("Could not update the task", response.error);
    }
  }

  const usage = initialData.usage;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle className="flex items-center gap-2">
              AI assistant
              <Badge variant={initialData.mode.remote ? "primary" : "default"} size="sm">
                {initialData.mode.remote ? initialData.mode.model : "local engine"}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Analyses the real tasks, dates and activity in {projectName}.
            </p>
          </div>
        </div>
        {initialData.history.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((value) => !value)}
            aria-expanded={showHistory}
          >
            <History className="size-3.5" aria-hidden />
            History
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const busy = running === action.kind;
            return (
              <button
                key={action.kind}
                type="button"
                disabled={Boolean(running)}
                onClick={() => void run(action.kind)}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-medium transition hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                  running && !busy && "opacity-50",
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                ) : (
                  <Icon className="size-4 text-primary" aria-hidden />
                )}
                <span>
                  <span className="block leading-tight">{action.label}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {result?.kind === "breakdown" || running === "breakdown" ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-4">
            <label htmlFor="ai-brief" className="text-sm font-medium">
              Project brief to break down
            </label>
            <Textarea
              id="ai-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Describe the goal, deliverables and constraints…"
              className="bg-surface"
              maxLength={4000}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{brief.length}/4000 characters</span>
              <Button
                size="sm"
                onClick={() => void run("breakdown")}
                loading={running === "breakdown"}
                disabled={brief.trim().length < 20}
              >
                <Wand2 className="size-3.5" aria-hidden />
                Generate tasks
              </Button>
            </div>
          </div>
        ) : null}

        {showHistory ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent runs
            </p>
            {initialData.history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.output && setResult(item.output)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted"
              >
                <span className="truncate">
                  {item.output?.title ?? `${item.kind} run`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <Alert tone="danger" title="Assistant error">
            {error}
          </Alert>
        ) : null}

        {running && !result ? (
          <div className="space-y-2 rounded-lg border border-border p-4" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analysing tasks, due dates and activity…
            </p>
            <div className="space-y-2 pt-1">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          </div>
        ) : null}

        {!running && !result ? (
          <EmptyState
            icon={<Bot className="size-5" aria-hidden />}
            title="Ask the assistant about this project"
            description="Pick an analysis above. Everything runs server-side against your real workspace data — no data leaves the app unless you configure an LLM provider."
            className="py-8"
          />
        ) : null}

        {result ? (
          <div className="space-y-4 rounded-lg border border-border p-4 animate-[var(--animate-fade-in)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{result.title}</h3>
              <Badge variant="outline" size="sm">
                {result.provider === "openai" ? result.model : "local analysis engine"}
              </Badge>
            </div>

            {result.stats.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {result.stats.map((stat) => (
                  <div
                    key={`${stat.label}-${stat.value}`}
                    className="rounded-md border border-border bg-surface-muted/50 px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="rounded-md bg-accent/60 px-3 py-2 text-sm font-medium">{result.summary}</p>

            <Markdown content={result.markdown} className="space-y-2" />

            {/* Task breakdown → one-click add */}
            {result.suggestions && result.suggestions.length > 0 ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {result.suggestions.length} suggested task(s)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelected(
                          Object.fromEntries(result.suggestions!.map((_, index) => [index, true])),
                        )
                      }
                    >
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void addSuggestedTasks()}
                      loading={applying}
                      loadingLabel="Adding…"
                    >
                      <CheckCheck className="size-3.5" aria-hidden />
                      Add selected
                    </Button>
                  </div>
                </div>

                <ul className="space-y-2">
                  {result.suggestions.map((suggestion, index) => (
                    <li
                      key={`${suggestion.title}-${index}`}
                      className="flex items-start gap-3 rounded-md p-2 transition hover:bg-surface-muted"
                    >
                      <input
                        type="checkbox"
                        id={`suggestion-${index}`}
                        checked={selected[index] !== false}
                        onChange={(event) =>
                          setSelected((current) => ({ ...current, [index]: event.target.checked }))
                        }
                        className="mt-1 size-4 accent-[var(--primary)]"
                      />
                      <label htmlFor={`suggestion-${index}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{suggestion.title}</span>
                          <Badge
                            size="sm"
                            variant={
                              suggestion.priority === "URGENT"
                                ? "danger"
                                : suggestion.priority === "HIGH"
                                  ? "warning"
                                  : suggestion.priority === "MEDIUM"
                                    ? "info"
                                    : "default"
                            }
                          >
                            {priorityLabel(suggestion.priority)}
                          </Badge>
                          {suggestion.dueInDays !== null ? (
                            <span className="text-xs text-muted-foreground">
                              ~{suggestion.dueInDays}d
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {suggestion.rationale}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Priority suggestions → apply individually */}
            {result.prioritySuggestions && result.prioritySuggestions.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-semibold">Ranked by risk score</p>
                <ul className="space-y-2">
                  {result.prioritySuggestions.slice(0, 8).map((suggestion) => {
                    const applied = appliedPriorities[suggestion.taskId];
                    const changed = suggestion.suggestedPriority !== suggestion.currentPriority;
                    return (
                      <li key={suggestion.taskId} className="rounded-md p-2 hover:bg-surface-muted">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 text-sm font-medium">{suggestion.title}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {priorityLabel(suggestion.currentPriority)} →{" "}
                              <strong className="text-foreground">
                                {priorityLabel(suggestion.suggestedPriority)}
                              </strong>
                            </span>
                            <Badge size="sm" variant={suggestion.score >= 60 ? "danger" : suggestion.score >= 40 ? "warning" : "default"}>
                              {suggestion.score}
                            </Badge>
                            {changed ? (
                              applied ? (
                                <Badge size="sm" variant="success">
                                  applied
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    void applyPriority(suggestion.taskId, suggestion.suggestedPriority)
                                  }
                                >
                                  Apply
                                </Button>
                              )
                            ) : (
                              <Badge size="sm" variant="success">
                                correct
                              </Badge>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {suggestion.reasons.join(" · ")}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* Risks */}
            {result.risks && result.risks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Detected risks</p>
                <ul className="space-y-2">
                  {result.risks.map((risk, index) => (
                    <li
                      key={`${risk.label}-${index}`}
                      className="flex items-start gap-3 rounded-md border border-border p-3"
                    >
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          risk.severity === "critical" || risk.severity === "high"
                            ? "text-danger"
                            : "text-warning",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {risk.label}
                          <Badge size="sm" variant={RISK_TONES[risk.severity]}>
                            {risk.severity}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{risk.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.risks && result.risks.length === 0 ? (
              <Alert tone="success" title="No risks detected">
                Nothing overdue, stalled or blocked in this project.
              </Alert>
            ) : null}
          </div>
        ) : null}

        <p className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {usage.runsToday} assistant run{usage.runsToday === 1 ? "" : "s"} today (limit{" "}
            {usage.dailyLimit})
          </span>
          <span className="inline-flex items-center gap-1">
            <Rocket className="size-3" aria-hidden />
            {initialData.mode.remote ? "Remote LLM configured" : "Runs fully offline"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
