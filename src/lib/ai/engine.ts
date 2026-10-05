/**
 * TaskFlow AI — local analysis engine.
 *
 * Deterministic, dependency-free heuristics that operate on the *real* project
 * data. This powers the assistant when no external LLM is configured, and acts
 * as the guaranteed fallback whenever a remote provider errors, so the feature
 * never breaks the product.
 */

import type { AiKind } from "@/lib/validation";

export type AiTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type AiProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: Date | null;
  createdAt: Date;
  tasks: AiTask[];
  memberNames: string[];
};

export type AiActivity = { message: string; createdAt: Date };

export type AiSuggestion = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueInDays: number | null;
  rationale: string;
};

export type AiPrioritySuggestion = {
  taskId: string;
  title: string;
  currentPriority: string;
  suggestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  score: number;
  reasons: string[];
};

export type AiRisk = {
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
  taskId?: string;
  kind: "overdue" | "blocked" | "stale" | "unassigned" | "project" | "workload" | "hygiene";
};

export type AiStat = { label: string; value: string };

export type AiResponse = {
  kind: AiKind;
  title: string;
  summary: string;
  bullets: string[];
  markdown: string;
  stats: AiStat[];
  suggestions?: AiSuggestion[];
  prioritySuggestions?: AiPrioritySuggestion[];
  risks?: AiRisk[];
  provider: string;
  model?: string;
  generatedAt: string;
};

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                  */
/* -------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

export function isOverdue(task: AiTask, today: Date): boolean {
  if (!task.dueDate || task.status === "DONE") return false;
  return startOfDay(task.dueDate).getTime() < startOfDay(today).getTime();
}

const BLOCKED_PATTERNS = [
  /\bblock(ed|er|ing)\b/i,
  /\bwaiting (on|for)\b/i,
  /\bdepends on\b/i,
  /\bon hold\b/i,
  /\bstuck\b/i,
  /\bpending (approval|review|vendor|client)\b/i,
];

const URGENT_PATTERNS = [
  /\burgent\b/i,
  /\basap\b/i,
  /\bcritical\b/i,
  /\boutage\b/i,
  /\bproduction (issue|down|bug)\b/i,
  /\bsecurity\b/i,
  /\bbreach\b/i,
  /\bclient (escalation|deadline)\b/i,
  /\bsev[ -]?[12]\b/i,
];

export function looksBlocked(task: AiTask): boolean {
  const haystack = `${task.title} ${task.description ?? ""}`;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function looksUrgent(task: AiTask): boolean {
  const haystack = `${task.title} ${task.description ?? ""}`;
  return URGENT_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function projectProgress(project: AiProject): number {
  if (project.tasks.length === 0) return 0;
  const done = project.tasks.filter((task) => task.status === "DONE").length;
  return Math.round((done / project.tasks.length) * 100);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanSentence(value: string): string {
  return value
    .replace(/^[\s\-*•\d.)\]]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/*                              Project statistics                             */
/* -------------------------------------------------------------------------- */

export type ProjectStats = {
  total: number;
  done: number;
  inProgress: number;
  review: number;
  todo: number;
  overdue: number;
  dueThisWeek: number;
  unassigned: number;
  blocked: number;
  completedLast7Days: number;
  progress: number;
  daysToDeadline: number | null;
  workload: { name: string; open: number; overdue: number }[];
  byPriority: Record<string, number>;
};

export function computeStats(project: AiProject, today: Date): ProjectStats {
  const stats: ProjectStats = {
    total: project.tasks.length,
    done: 0,
    inProgress: 0,
    review: 0,
    todo: 0,
    overdue: 0,
    dueThisWeek: 0,
    unassigned: 0,
    blocked: 0,
    completedLast7Days: 0,
    progress: projectProgress(project),
    daysToDeadline: project.deadline ? daysBetween(today, project.deadline) : null,
    workload: [],
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
  };

  const workload = new Map<string, { open: number; overdue: number }>();

  for (const task of project.tasks) {
    switch (task.status) {
      case "DONE":
        stats.done += 1;
        break;
      case "IN_PROGRESS":
        stats.inProgress += 1;
        break;
      case "REVIEW":
        stats.review += 1;
        break;
      default:
        stats.todo += 1;
    }

    stats.byPriority[task.priority] = (stats.byPriority[task.priority] ?? 0) + 1;

    if (isOverdue(task, today)) stats.overdue += 1;
    if (looksBlocked(task) && task.status !== "DONE") stats.blocked += 1;
    if (!task.assigneeId && task.status !== "DONE") stats.unassigned += 1;

    if (task.dueDate && task.status !== "DONE") {
      const delta = daysBetween(today, task.dueDate);
      if (delta >= 0 && delta <= 7) stats.dueThisWeek += 1;
    }

    if (
      task.completedAt &&
      task.completedAt.getTime() > today.getTime() - 7 * DAY &&
      task.status === "DONE"
    ) {
      stats.completedLast7Days += 1;
    }

    if (task.status !== "DONE") {
      const name = task.assigneeName ?? "Unassigned";
      const entry = workload.get(name) ?? { open: 0, overdue: 0 };
      entry.open += 1;
      if (isOverdue(task, today)) entry.overdue += 1;
      workload.set(name, entry);
    }
  }

  stats.workload = [...workload.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.open - a.open);

  return stats;
}

/* -------------------------------------------------------------------------- */
/*                                   Summary                                   */
/* -------------------------------------------------------------------------- */

export function localSummary(project: AiProject, today: Date, activity: AiActivity[] = []): AiResponse {
  const stats = computeStats(project, today);
  const bullets: string[] = [];

  const openTasks = project.tasks.filter((task) => task.status !== "DONE");
  const nextDue = [...openTasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];

  bullets.push(
    stats.progress >= 75
      ? `Delivery is on track — ${stats.progress}% of the ${stats.total} tasks are complete.`
      : stats.progress >= 40
        ? `Work is progressing: ${stats.progress}% complete (${stats.done}/${stats.total} tasks).`
        : `Early stage: only ${stats.progress}% complete (${stats.done}/${stats.total} tasks).`,
  );

  if (stats.overdue > 0) {
    bullets.push(
      `${stats.overdue} task${stats.overdue === 1 ? "" : "s"} past due — clear these first to protect the timeline.`,
    );
  } else {
    bullets.push("No overdue tasks. Due dates are currently under control.");
  }

  bullets.push(
    `${stats.inProgress} in progress, ${stats.review} in review, ${stats.todo} not started.`,
  );

  if (stats.byPriority.URGENT + stats.byPriority.HIGH > 0) {
    bullets.push(
      `${stats.byPriority.URGENT} urgent and ${stats.byPriority.HIGH} high priority item${stats.byPriority.HIGH === 1 ? "" : "s"} need attention.`,
    );
  }

  if (stats.daysToDeadline !== null) {
    bullets.push(
      stats.daysToDeadline < 0
        ? `The deadline passed ${Math.abs(stats.daysToDeadline)} day(s) ago with ${stats.total - stats.done} tasks still open.`
        : `Deadline in ${stats.daysToDeadline} day${stats.daysToDeadline === 1 ? "" : "s"} — roughly ${(stats.total - stats.done) / Math.max(stats.daysToDeadline, 1) } open task(s) per remaining day.`,
    );
  }

  if (stats.workload.length > 0) {
    const top = stats.workload[0];
    bullets.push(`${top.name} carries the largest load with ${top.open} open task${top.open === 1 ? "" : "s"}.`);
  }

  if (nextDue) {
    bullets.push(
      `Next up: "${nextDue.title}" due in ${daysBetween(today, nextDue.dueDate!)} day(s).`,
    );
  }

  if (activity.length > 0) {
    bullets.push(`Latest activity: ${activity.slice(0, 3).map((item) => item.message).join(" • ")}`);
  }

  const summary =
    `${project.name} is ${stats.progress}% complete with ${stats.total - stats.done} of ${stats.total} tasks still open` +
    (stats.overdue > 0 ? `, including ${stats.overdue} overdue` : "") +
    (stats.blocked > 0 ? ` and ${stats.blocked} flagged as blocked` : "") +
    ". " +
    (stats.progress >= 60
      ? "Momentum looks healthy; keep the review queue moving."
      : "Focus on unblocking work in progress before starting anything new.");

  const markdown = [
    `## Summary — ${project.name}`,
    "",
    summary,
    "",
    "### Signals",
    ...bullets.map((bullet) => `- ${bullet}`),
  ].join("\n");

  return {
    kind: "summary",
    title: `Project summary — ${project.name}`,
    summary,
    bullets,
    markdown,
    stats: statCards(stats),
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

function statCards(stats: ProjectStats): AiStat[] {
  return [
    { label: "Progress", value: `${stats.progress}%` },
    { label: "Open tasks", value: `${stats.total - stats.done}` },
    { label: "Overdue", value: `${stats.overdue}` },
    { label: "Blocked", value: `${stats.blocked}` },
    { label: "Done last 7d", value: `${stats.completedLast7Days}` },
    {
      label: "Deadline",
      value:
        stats.daysToDeadline === null
          ? "Not set"
          : stats.daysToDeadline < 0
            ? `${Math.abs(stats.daysToDeadline)}d overdue`
            : `${stats.daysToDeadline}d left`,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*                              Task breakdown                                 */
/* -------------------------------------------------------------------------- */

type DomainRule = {
  match: RegExp;
  verb: string;
  priority: AiSuggestion["priority"];
  dueInDays: number;
  note: string;
};

const DOMAIN_RULES: DomainRule[] = [
  { match: /secur|auth[en]?|login|password|permission|privacy|gdpr/i, verb: "Harden", priority: "HIGH", dueInDays: 5, note: "security-critical work" },
  { match: /bug|fix|error|broken|crash|regression/i, verb: "Fix", priority: "URGENT", dueInDays: 2, note: "defect with production impact" },
  { match: /api|endpoint|integration|webhook|backend|service|database|schema|migration/i, verb: "Implement", priority: "HIGH", dueInDays: 7, note: "backend dependency for other work" },
  { match: /design|wireframe|mockup|ui|ux|prototype|figma|layout/i, verb: "Design", priority: "MEDIUM", dueInDays: 6, note: "design deliverable that unblocks frontend" },
  { match: /deploy|release|ci|cd|pipeline|infra|docker|kubernetes|monitor|observability/i, verb: "Set up", priority: "MEDIUM", dueInDays: 10, note: "delivery and operations work" },
  { match: /test|qa|coverage|regression suite|acceptance|verif/i, verb: "Test", priority: "HIGH", dueInDays: 9, note: "quality gate before release" },
  { match: /doc|readme|guide|onboarding|training|handbook/i, verb: "Document", priority: "LOW", dueInDays: 12, note: "documentation, can follow the build" },
  { match: /analytics|metric|report|dashboard|data|tracking|kpi/i, verb: "Instrument", priority: "MEDIUM", dueInDays: 8, note: "measurement work supporting decisions" },
  { match: /market|launch|campaign|content|seo|copy|brand/i, verb: "Prepare", priority: "MEDIUM", dueInDays: 8, note: "go-to-market activity" },
  { match: /research|investigate|spike|evaluate|explore|compare/i, verb: "Research", priority: "MEDIUM", dueInDays: 4, note: "discovery to de-risk later decisions" },
  { match: /refactor|cleanup|tech debt|performance|optimi[sz]e/i, verb: "Refactor", priority: "LOW", dueInDays: 14, note: "quality improvement, schedulable" },
  { match: /review|approve|sign ?off|feedback/i, verb: "Review", priority: "MEDIUM", dueInDays: 3, note: "approval step blocking downstream work" },
];

/** Filler prefixes that add no meaning to a task title. */
const LEADING_FILLER =
  /^(?:please\s+|also\s+|then\s+|and\s+|finally\s+|next\s+|we\s+(?:need|should|must|have)\s+to\s+|we\s+should\s+|we\s+must\s+|i\s+(?:want|need)\s+to\s+|the\s+team\s+should\s+|let'?s\s+|need\s+to\s+|must\s+|should\s+|to\s+)+/i;

/** Verbs that already work as the start of an imperative task title. */
const IMPERATIVE_VERBS = new Set([
  "add", "align", "analyse", "analyze", "assemble", "audit", "automate", "book", "brand",
  "build", "buy", "catch", "centralise", "centralize", "choose", "clean", "close", "collect",
  "compare", "complete", "configure", "confirm", "connect", "consolidate", "coordinate",
  "create", "cut", "decide", "define", "deliver", "deploy", "design", "draft", "email",
  "eliminate", "enable", "ensure", "estimate", "evaluate", "expand", "expose", "extract",
  "finalise", "finalize", "fix", "follow", "gather", "generate", "harden", "host", "implement",
  "improve", "instrument", "integrate", "investigate", "invite", "kick", "launch", "learn",
  "list", "map", "measure", "migrate", "mock", "modernise", "modernize", "monitor", "move",
  "negotiate", "notify", "onboard", "open", "optimise", "optimize", "organise", "organize",
  "own", "plan", "port", "prepare", "present", "prioritise", "prioritize", "produce", "profile",
  "prototype", "provide", "publish", "reach", "rebuild", "recruit", "reduce", "refactor",
  "refresh", "release", "remove", "rename", "replace", "report", "request", "research",
  "restructure", "reveal", "review", "revise", "roll", "run", "scale", "scan", "schedule",
  "scope", "secure", "select", "set", "share", "ship", "simplify", "sketch", "spec", "speed",
  "split", "sponsor", "staff", "standardise", "standardize", "stream", "structure", "submit",
  "summarise", "summarize", "support", "swap", "sync", "teach", "test", "track", "train",
  "translate", "triage", "tune", "unblock", "update", "upgrade", "validate", "verify", "watch",
  "wire", "work", "write",
]);

function splitCompound(sentence: string): string[] {
  const cleaned = sentence.replace(/[.;:]+$/, "").trim();
  if (!cleaned) return [];

  const wordCount = cleaned.split(/\s+/).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;

  // Only break a clause apart when it clearly lists several deliverables.
  if (commaCount < 2 && wordCount <= 12) return [cleaned];

  return cleaned
    .split(/\s*,\s*|\s+(?:and also|and then|then|and)\s+(?=[a-z])/i)
    .map((part) => part.trim())
    .filter((part) => part.split(/\s+/).filter(Boolean).length >= 2);
}

/**
 * Turn free-form prose (paragraphs, bullets, semicolon lists) into atomic
 * work items.
 */
function splitDescription(description: string): string[] {
  const clauses: string[] = [];

  for (const rawLine of description.replace(/\r\n/g, "\n").split(/\n+/)) {
    const line = cleanSentence(rawLine);
    if (line.length < 3) continue;

    for (const sentence of line.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/)) {
      clauses.push(...splitCompound(sentence));
    }
  }

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const clause of clauses) {
    const key = clause.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clause);
  }

  return unique.length > 0 ? unique : ["Deliver the project scope described in the brief"];
}

/** Build a concise imperative task title from a clause. */
function toTaskTitle(clause: string): string {
  let text = cleanSentence(clause).replace(/^(?:the|our|a|an)\s+/i, "");
  text = text.replace(LEADING_FILLER, "").trim();
  text = text.replace(/[.;:,]+$/, "").trim();

  if (text.length === 0) return "Complete the outstanding work";

  const firstWord = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, "");
  const stem = firstWord
    .replace(/^(?:re|de|un|pre|co|over|under)/, "")
    .replace(/(?:ing|es|s)$/, "");
  const startsWithVerb =
    IMPERATIVE_VERBS.has(firstWord) ||
    IMPERATIVE_VERBS.has(stem) ||
    IMPERATIVE_VERBS.has(`${stem}e`);

  const normalized = titleCase(text);
  let title = startsWithVerb
    ? normalized
    : `${verbFor(text)} ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;

  // Trim at a word boundary without leaving a dangling ellipsis.
  if (title.length > 96) {
    const cut = title.slice(0, 96);
    title = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).trim()}`;
  }

  return title;
}

function verbFor(clause: string): string {
  return DOMAIN_RULES.find((rule) => rule.match.test(clause))?.verb ?? "Deliver";
}

/** Turn a project description into a prioritised, actionable task list. */
export function localBreakdown(project: AiProject, description: string): AiResponse {
  const source = description.trim().length > 0 ? description : (project.description ?? "");
  const segments = splitDescription(source).slice(0, 16);
  const existingTitles = new Set(project.tasks.map((task) => task.title.toLowerCase()));
  const suggestions: AiSuggestion[] = [];

  for (const segment of segments) {
    const rule = DOMAIN_RULES.find((candidate) => candidate.match.test(segment));
    const title = toTaskTitle(segment);

    if (title.length < 4 || existingTitles.has(title.toLowerCase())) continue;

    suggestions.push({
      title,
      description: `Derived from the project brief: “${segment.slice(0, 300)}”`,
      priority: rule?.priority ?? "MEDIUM",
      dueInDays: rule?.dueInDays ?? 7,
      rationale: rule ? `Matched ${rule.note}.` : "Execution step taken from the project brief.",
    });
  }

  // Make sure the plan covers the basics even when the brief is thin.
  const coverage: { test: RegExp; suggestion: AiSuggestion }[] = [
    {
      test: /test|qa|coverage/i,
      suggestion: {
        title: "Define acceptance criteria and test the critical paths",
        description: "Agree on what “done” means, then verify the primary user journeys end to end.",
        priority: "HIGH",
        dueInDays: 9,
        rationale: "Every plan needs an explicit quality gate.",
      },
    },
    {
      test: /deploy|release|launch/i,
      suggestion: {
        title: "Prepare release and rollback plan",
        description: "Document the deployment steps, feature flags and how to roll back safely.",
        priority: "MEDIUM",
        dueInDays: 12,
        rationale: "Reduces delivery risk at the end of the project.",
      },
    },
    {
      test: /doc|readme|guide/i,
      suggestion: {
        title: "Write handover documentation",
        description: "Summarise decisions, setup steps and open questions for the team.",
        priority: "LOW",
        dueInDays: 14,
        rationale: "Keeps knowledge shared beyond the delivery window.",
      },
    },
  ];

  const covered = (pattern: RegExp) =>
    pattern.test(source) ||
    suggestions.some((suggestion) => pattern.test(suggestion.title) || pattern.test(suggestion.description));

  for (const item of coverage) {
    if (!covered(item.test)) suggestions.push(item.suggestion);
  }

  const trimmed = suggestions.slice(0, 16);
  const highOrUrgent = trimmed.filter(
    (suggestion) => suggestion.priority === "URGENT" || suggestion.priority === "HIGH",
  ).length;
  const window = Math.max(...trimmed.map((suggestion) => suggestion.dueInDays ?? 7), 7);

  const summary = `Generated ${trimmed.length} tasks from the project description, ${highOrUrgent} of them high or urgent priority. Suggested delivery window: about ${window} days.`;

  const bullets = trimmed.map(
    (suggestion) =>
      `**${suggestion.title}** — ${suggestion.priority} · due in ~${suggestion.dueInDays}d. ${suggestion.rationale}`,
  );

  const markdown = [
    `## Task breakdown — ${project.name}`,
    "",
    summary,
    "",
    ...bullets.map((bullet) => `- ${bullet}`),
    "",
    "_Review the list, then add the tasks you want to the project in one click._",
  ].join("\n");

  return {
    kind: "breakdown",
    title: `Task breakdown — ${project.name}`,
    summary,
    bullets,
    markdown,
    stats: [
      { label: "Generated", value: `${trimmed.length}` },
      { label: "High/urgent", value: `${highOrUrgent}` },
      { label: "Existing tasks", value: `${project.tasks.length}` },
      { label: "Est. window", value: `${window}d` },
    ],
    suggestions: trimmed,
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                             Priority suggestions                            */
/* -------------------------------------------------------------------------- */

export function scoreTask(task: AiTask, project: AiProject, today: Date): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (task.dueDate) {
    const delta = daysBetween(today, task.dueDate);
    if (task.status !== "DONE") {
      if (delta < 0) {
        score += 45 + Math.min(Math.abs(delta) * 2, 25);
        reasons.push(`Overdue by ${Math.abs(delta)} day(s)`);
      } else if (delta === 0) {
        score += 38;
        reasons.push("Due today");
      } else if (delta <= 3) {
        score += 26;
        reasons.push(`Due in ${delta} day(s)`);
      } else if (delta <= 7) {
        score += 14;
        reasons.push(`Due this week (${delta} days)`);
      }
    }
  } else if (task.status !== "DONE") {
    score += 2;
    reasons.push("No due date set");
  }

  if (looksUrgent(task)) {
    score += 20;
    reasons.push("Language signals urgency (critical/security/production)");
  }

  if (looksBlocked(task) && task.status !== "DONE") {
    score += 12;
    reasons.push("Mentions a blocker or external dependency");
  }

  if (!task.assigneeId && task.status !== "DONE") {
    score += 8;
    reasons.push("Nobody is assigned");
  }

  if (task.status === "REVIEW") {
    score += 10;
    reasons.push("Waiting in review — close the loop");
  }

  if (task.status === "IN_PROGRESS") {
    const stale = daysBetween(task.updatedAt, today);
    if (stale > 7) {
      score += 12;
      reasons.push(`In progress with no update for ${stale} days`);
    } else {
      score += 5;
      reasons.push("Actively in progress");
    }
  }

  if (project.deadline && task.status !== "DONE") {
    const toDeadline = daysBetween(today, project.deadline);
    if (toDeadline <= 7) {
      score += 10;
      reasons.push(`Project deadline is ${toDeadline <= 0 ? "overdue" : `in ${toDeadline} day(s)`}`);
    }
  }

  return { score: Math.min(score, 100), reasons };
}

export function scoreToPriority(score: number): AiPrioritySuggestion["suggestedPriority"] {
  if (score >= 60) return "URGENT";
  if (score >= 40) return "HIGH";
  if (score >= 22) return "MEDIUM";
  return "LOW";
}

export function localPriorities(project: AiProject, today: Date): AiResponse {
  const open = project.tasks.filter((task) => task.status !== "DONE");
  const ranked = open
    .map((task) => {
      const { score, reasons } = scoreTask(task, project, today);
      return {
        taskId: task.id,
        title: task.title,
        currentPriority: task.priority,
        suggestedPriority: scoreToPriority(score),
        score,
        reasons: reasons.length > 0 ? reasons : ["No risk signals detected"],
      } satisfies AiPrioritySuggestion;
    })
    .sort((a, b) => b.score - a.score);

  const changes = ranked.filter((item) => item.suggestedPriority !== item.currentPriority);
  const summary = changes.length
    ? `${changes.length} of ${ranked.length} open tasks have a priority that no longer matches their risk profile. The most urgent action is "${ranked[0].title}" (score ${ranked[0].score}/100).`
    : `All ${ranked.length} open tasks already carry priorities that match their risk profile. Re-check after new due dates land.`;

  const bullets = ranked
    .slice(0, 10)
    .map(
      (item) =>
        `**${item.title}** — ${item.currentPriority} → **${item.suggestedPriority}** (score ${item.score}). ${item.reasons.join("; ")}.`,
    );

  const markdown = [
    `## Priority recommendations — ${project.name}`,
    "",
    summary,
    "",
    ...bullets.map((bullet) => `- ${bullet}`),
  ].join("\n");

  return {
    kind: "priorities",
    title: `Priority suggestions — ${project.name}`,
    summary,
    bullets,
    markdown,
    stats: [
      { label: "Open tasks", value: `${ranked.length}` },
      { label: "Suggested changes", value: `${changes.length}` },
      { label: "Score > 60", value: `${ranked.filter((item) => item.score >= 60).length}` },
      { label: "Unassigned", value: `${project.tasks.filter((t) => !t.assigneeId && t.status !== "DONE").length}` },
    ],
    prioritySuggestions: ranked,
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                              Risk / blocker scan                            */
/* -------------------------------------------------------------------------- */

export function localRisks(project: AiProject, today: Date): AiResponse {
  const risks: AiRisk[] = [];
  const stats = computeStats(project, today);

  for (const task of project.tasks) {
    if (task.status === "DONE") continue;

    if (isOverdue(task, today)) {
      const days = Math.abs(daysBetween(today, task.dueDate!));
      risks.push({
        kind: "overdue",
        label: "Overdue task",
        severity: days > 7 || task.priority === "URGENT" ? "critical" : "high",
        detail: `“${task.title}” is ${days} day${days === 1 ? "" : "s"} past due${
          task.assigneeName ? ` (owner: ${task.assigneeName})` : " and unassigned"
        }.`,
        taskId: task.id,
      });
    }

    if (looksBlocked(task)) {
      risks.push({
        kind: "blocked",
        label: "Possible blocker",
        severity: task.priority === "URGENT" || task.priority === "HIGH" ? "high" : "medium",
        detail: `“${task.title}” references a dependency or waiting state — confirm what is blocking progress.`,
        taskId: task.id,
      });
    }

    if (task.status === "IN_PROGRESS") {
      const stale = daysBetween(task.updatedAt, today);
      if (stale >= 10) {
        risks.push({
          kind: "stale",
          label: "Stalled in progress",
          severity: "medium",
          detail: `“${task.title}” has not been updated for ${stale} days.`,
          taskId: task.id,
        });
      }
    }

    if (!task.assigneeId && task.dueDate) {
      const delta = daysBetween(today, task.dueDate);
      if (delta >= 0 && delta <= 3) {
        risks.push({
          kind: "unassigned",
          label: "Due soon, unassigned",
          severity: "medium",
          detail: `“${task.title}” is due in ${delta} day(s) with no assignee.`,
          taskId: task.id,
        });
      }
    }

    if (!task.dueDate && (task.priority === "URGENT" || task.priority === "HIGH")) {
      risks.push({
        kind: "hygiene",
        label: "No due date",
        severity: "low",
        detail: `“${task.title}” is ${task.priority.toLowerCase()} priority but has no deadline.`,
        taskId: task.id,
      });
    }
  }

  if (stats.daysToDeadline !== null && stats.daysToDeadline <= 7 && stats.progress < 70) {
    risks.push({
      kind: "project",
      label: "Delivery risk",
      severity: stats.daysToDeadline <= 0 ? "critical" : "high",
      detail: `The project deadline is ${stats.daysToDeadline <= 0 ? "already past" : `in ${stats.daysToDeadline} day(s)`} while completion sits at ${stats.progress}%. Scope is likely to slip.`,
    });
  }

  const overloaded = stats.workload.find((entry) => entry.open >= 6 && entry.name !== "Unassigned");
  if (overloaded) {
    risks.push({
      kind: "workload",
      label: "Workload concentration",
      severity: "low",
      detail: `${overloaded.name} owns ${overloaded.open} open tasks — consider redistributing.`,
    });
  }

  if (stats.unassigned >= 3) {
    risks.push({
      kind: "workload",
      label: "Unassigned backlog",
      severity: "low",
      detail: `${stats.unassigned} open tasks have no assignee.`,
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  const critical = risks.filter((risk) => risk.severity === "critical").length;
  const high = risks.filter((risk) => risk.severity === "high").length;

  const summary = risks.length
    ? `Found ${risks.length} risk${risks.length === 1 ? "" : "s"} (${critical} critical, ${high} high). ${stats.overdue} task(s) are overdue and ${stats.blocked} look blocked.`
    : "No overdue, blocked or stalled tasks detected. The project looks healthy.";

  const markdown = [
    `## Risks & blockers — ${project.name}`,
    "",
    summary,
    "",
    ...risks.map(
      (risk) => `- **${risk.label} (${risk.severity})** — ${risk.detail}`,
    ),
  ].join("\n");

  return {
    kind: "risks",
    title: `Risk scan — ${project.name}`,
    summary,
    bullets: risks.map((risk) => `${risk.label}: ${risk.detail}`),
    markdown,
    stats: [
      { label: "Total risks", value: `${risks.length}` },
      { label: "Critical", value: `${critical}` },
      { label: "Overdue", value: `${stats.overdue}` },
      { label: "Blocked", value: `${stats.blocked}` },
    ],
    risks,
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                               Status report                                 */
/* -------------------------------------------------------------------------- */

export function localReport(project: AiProject, today: Date, activity: AiActivity[] = []): AiResponse {
  const stats = computeStats(project, today);
  const risks = localRisks(project, today).risks ?? [];
  const priorities = (localPriorities(project, today).prioritySuggestions ?? []).slice(0, 3);

  const upcoming = [...project.tasks]
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  const healthEmoji =
    stats.overdue > 2 || (stats.daysToDeadline !== null && stats.daysToDeadline < 0)
      ? "🔴"
      : stats.overdue > 0 || risks.filter((risk) => risk.severity === "high").length > 0
        ? "🟠"
        : "🟢";

  const headline = `${healthEmoji} ${project.name} — ${stats.progress}% complete, ${stats.total - stats.done} open, ${stats.overdue} overdue`;

  const summary = `${headline}. ${stats.completedLast7Days} task(s) completed in the last 7 days${
    stats.daysToDeadline !== null
      ? `; the deadline is ${stats.daysToDeadline >= 0 ? `${stats.daysToDeadline} day(s) away` : `${Math.abs(stats.daysToDeadline)} day(s) overdue`}`
      : ""
  }.`;

  const markdown = [
    `## Status report — ${project.name}`,
    "",
    headline,
    "",
    "### Progress",
    `- ${stats.done}/${stats.total} tasks done (${stats.progress}%)`,
    `- ${stats.inProgress} in progress, ${stats.review} in review, ${stats.todo} not started`,
    `- ${stats.completedLast7Days} completed in the last 7 days`,
    "",
    "### Risks & blockers",
    ...(risks.length
      ? risks.slice(0, 6).map((risk) => `- (${risk.severity}) ${risk.detail}`)
      : ["- None detected"]),
    "",
    "### Upcoming",
    ...(upcoming.length
      ? upcoming.map(
          (task) =>
            `- ${task.title} — due ${task.dueDate!.toISOString().slice(0, 10)}${
              task.assigneeName ? ` — ${task.assigneeName}` : " — unassigned"
            }`,
        )
      : ["- No upcoming due dates"]),
    "",
    "### Recommended next actions",
    ...(priorities.length
      ? priorities.map((item) => `- ${item.title} → ${item.suggestedPriority} (${item.reasons[0]})`)
      : ["- Keep the current plan"]),
    ...(activity.length
      ? ["", "### Recent activity", ...activity.slice(0, 5).map((item) => `- ${item.message}`)]
      : []),
  ].join("\n");

  return {
    kind: "report",
    title: `Status report — ${project.name}`,
    summary,
    bullets: [
      `${stats.progress}% complete`,
      `${stats.overdue} overdue task(s)`,
      `${risks.filter((risk) => risk.severity === "critical" || risk.severity === "high").length} high-risk item(s)`,
      stats.daysToDeadline !== null ? `${stats.daysToDeadline} day(s) to deadline` : "No deadline set",
    ],
    markdown,
    stats: statCards(stats),
    risks,
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Dispatch                                   */
/* -------------------------------------------------------------------------- */

export function runLocalEngine(
  kind: AiKind,
  project: AiProject,
  options: { prompt?: string; today?: Date; activity?: AiActivity[] } = {},
): AiResponse {
  const today = options.today ?? new Date();
  const activity = options.activity ?? [];

  switch (kind) {
    case "summary":
      return localSummary(project, today, activity);
    case "breakdown":
      return localBreakdown(project, options.prompt ?? "");
    case "priorities":
      return localPriorities(project, today);
    case "risks":
      return localRisks(project, today);
    case "report":
      return localReport(project, today, activity);
    default:
      return localSummary(project, today, activity);
  }
}
