import { z } from "zod";

import { hasRemoteAi, serverEnv } from "@/lib/env";
import {
  computeStats,
  runLocalEngine,
  type AiActivity,
  type AiProject,
  type AiResponse,
} from "@/lib/ai/engine";
import type { AiKind } from "@/lib/validation";

/**
 * AI provider boundary.
 *
 * `AI_PROVIDER=local` (default) uses the built-in analysis engine — no network,
 * no API key, fully deterministic.
 *
 * `AI_PROVIDER=openai` calls any OpenAI-compatible `/chat/completions`
 * endpoint. The API key is read from the server-side environment only; it is
 * never returned to, or referenced by, client code. Any failure (missing key,
 * timeout, invalid JSON) degrades gracefully to the local engine so the
 * assistant remains functional.
 */

const remoteResponseSchema = z.object({
  summary: z.string().min(1).max(4000),
  bullets: z.array(z.string().max(600)).max(24).optional(),
  markdown: z.string().max(20000).optional(),
  suggestions: z
    .array(
      z.object({
        title: z.string().min(2).max(140),
        description: z.string().max(1000).optional().default(""),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
        dueInDays: z.number().int().min(0).max(180).nullable().optional().default(null),
        rationale: z.string().max(400).optional().default(""),
      }),
    )
    .max(20)
    .optional(),
  prioritySuggestions: z
    .array(
      z.object({
        taskId: z.string(),
        title: z.string(),
        currentPriority: z.string(),
        suggestedPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        score: z.number().min(0).max(100),
        reasons: z.array(z.string().max(300)).max(6).default([]),
      }),
    )
    .max(50)
    .optional(),
  risks: z
    .array(
      z.object({
        label: z.string().max(120),
        severity: z.enum(["low", "medium", "high", "critical"]),
        detail: z.string().max(600),
        taskId: z.string().optional(),
        kind: z
          .enum(["overdue", "blocked", "stale", "unassigned", "project", "workload", "hygiene"])
          .default("hygiene"),
      }),
    )
    .max(50)
    .optional(),
});

const KIND_INSTRUCTIONS: Record<AiKind, string> = {
  summary:
    "Summarise the project for a busy manager. Cover overall progress, what is going well, what is behind, and the single most important next action.",
  breakdown:
    "Break the supplied project description into concrete, assignable tasks. Every task title starts with an imperative verb, is under 100 characters, and includes a realistic priority and due-in-days estimate.",
  priorities:
    "Review the open tasks and recommend a priority (LOW/MEDIUM/HIGH/URGENT) for each one, referencing due dates, blockers, urgency language and project deadline pressure. Return one entry per open task using its exact id.",
  risks:
    "Identify overdue tasks, blockers, stalled work, unassigned work due soon and delivery risks. Be specific and reference task titles. Only report genuine signals found in the data.",
  report:
    "Write a concise weekly status report a stakeholder could read in 60 seconds: progress, risks, upcoming work, and recommended next actions.",
};

type GenerateArgs = {
  kind: AiKind;
  project: AiProject;
  prompt?: string;
  activity?: AiActivity[];
  today?: Date;
};

/** True when the assistant will call a remote LLM. */
export function aiMode(): { remote: boolean; model: string } {
  const remote = hasRemoteAi();
  return {
    remote,
    model: remote ? serverEnv().OPENAI_MODEL : "TaskFlow local analysis engine",
  };
}

export async function generateAiResponse(args: GenerateArgs): Promise<AiResponse> {
  const local = runLocalEngine(args.kind, args.project, {
    prompt: args.prompt,
    today: args.today,
    activity: args.activity,
  });

  if (!hasRemoteAi()) return local;

  try {
    const remote = await callRemote(args);
    if (!remote) return local;

    const bullets = remote.bullets ?? local.bullets;

    return {
      ...local,
      // Remote prose, locally computed (always accurate) statistics.
      summary: remote.summary,
      bullets,
      markdown:
        remote.markdown ??
        [`## ${local.title}`, "", remote.summary, "", ...bullets.map((b) => `- ${b}`)].join("\n"),
      suggestions: remote.suggestions?.length
        ? remote.suggestions.map((suggestion) => ({
            ...suggestion,
            description: suggestion.description || "Generated from the project brief.",
            dueInDays: suggestion.dueInDays ?? null,
          }))
        : local.suggestions,
      // Keep locally detected risks/priorities when the model returns none, and
      // always trust local task ids for the one-click apply actions.
      risks: remote.risks?.length ? remote.risks : local.risks,
      prioritySuggestions: mergePrioritySuggestions(local, remote),
      provider: "openai",
      model: serverEnv().OPENAI_MODEL,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[taskflow] remote AI provider failed, using local engine:", error);
    return { ...local, provider: "local-fallback", summary: `${local.summary}` };
  }
}

function mergePrioritySuggestions(local: AiResponse, remote: z.infer<typeof remoteResponseSchema>) {
  if (!remote.prioritySuggestions?.length) return local.prioritySuggestions;
  const byId = new Map(local.prioritySuggestions?.map((item) => [item.taskId, item]) ?? []);
  return remote.prioritySuggestions.map((item) => ({
    ...item,
    // Local scores are deterministic and shown in the UI progress bar.
    score: byId.get(item.taskId)?.score ?? item.score,
    reasons: item.reasons.length ? item.reasons : (byId.get(item.taskId)?.reasons ?? []),
  }));
}

async function callRemote(args: GenerateArgs): Promise<z.infer<typeof remoteResponseSchema> | null> {
  const env = serverEnv();
  const stats = computeStats(args.project, args.today ?? new Date());

  const context = {
    project: {
      name: args.project.name,
      description: args.project.description,
      status: args.project.status,
      deadline: args.project.deadline?.toISOString().slice(0, 10) ?? null,
      progressPercent: stats.progress,
      teamMembers: args.project.memberNames,
    },
    statistics: {
      totalTasks: stats.total,
      done: stats.done,
      inProgress: stats.inProgress,
      inReview: stats.review,
      todo: stats.todo,
      overdue: stats.overdue,
      blocked: stats.blocked,
      unassigned: stats.unassigned,
      completedLast7Days: stats.completedLast7Days,
      daysToDeadline: stats.daysToDeadline,
    },
    openTasks: args.project.tasks
      .filter((task) => task.status !== "DONE")
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
        assignee: task.assigneeName,
        description: task.description ? task.description.slice(0, 400) : null,
        lastUpdated: task.updatedAt.toISOString().slice(0, 10),
      })),
    recentActivity: (args.activity ?? []).slice(0, 8).map((item) => item.message),
    userNotes: args.prompt?.slice(0, 2000) ?? null,
    today: (args.today ?? new Date()).toISOString().slice(0, 10),
  };

  const system = [
    "You are TaskFlow AI, a precise project-management analyst for small software teams.",
    KIND_INSTRUCTIONS[args.kind],
    "Never invent tasks, people or dates that are not present in the supplied JSON.",
    "Respond with JSON only, matching exactly this shape:",
    '{"summary": string, "bullets": string[], "markdown": string, "suggestions": [{"title","description","priority","dueInDays","rationale"}], "prioritySuggestions": [{"taskId","title","currentPriority","suggestedPriority","score","reasons"}], "risks": [{"label","severity","detail","taskId","kind"}]}',
    "Omit keys that are not relevant for the requested analysis. Keep markdown concise.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Analysis kind: ${args.kind}\n\nProject data:\n${JSON.stringify(context)}` },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Provider responded ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty completion");

    const parsed = remoteResponseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("Completion did not match the expected schema");
    return parsed.data;
  } finally {
    clearTimeout(timeout);
  }
}
