import { describe, expect, it } from "vitest";

import {
  computeStats,
  localBreakdown,
  localPriorities,
  localRisks,
  localReport,
  localSummary,
  scoreTask,
  type AiProject,
  type AiTask,
} from "@/lib/ai/engine";

const DAY = 24 * 60 * 60 * 1000;
const today = new Date("2026-03-10T09:00:00.000Z");

function task(overrides: Partial<AiTask> = {}): AiTask {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2, 8)}`,
    title: "Do something",
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    dueDate: null,
    assigneeId: "user-1",
    assigneeName: "Alex",
    createdAt: new Date(today.getTime() - 5 * DAY),
    updatedAt: new Date(today.getTime() - DAY),
    completedAt: null,
    ...overrides,
  };
}

function project(tasks: AiTask[]): AiProject {
  return {
    id: "project-1",
    name: "Website Redesign",
    description: "Rebuild the marketing site.",
    status: "ACTIVE",
    deadline: new Date(today.getTime() + 14 * DAY),
    createdAt: new Date(today.getTime() - 30 * DAY),
    memberNames: ["Alex", "Maya"],
    tasks,
  };
}

describe("computeStats", () => {
  it("counts statuses, overdue work and per-person load", () => {
    const stats = computeStats(
      project([
        task({ status: "DONE", completedAt: new Date(today.getTime() - 2 * DAY) }),
        task({ status: "IN_PROGRESS", dueDate: new Date(today.getTime() - 3 * DAY) }),
        task({ status: "TODO", dueDate: new Date(today.getTime() + 2 * DAY) }),
        task({ status: "REVIEW", assigneeId: null, assigneeName: null }),
      ]),
      today,
    );

    expect(stats.total).toBe(4);
    expect(stats.done).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.review).toBe(1);
    expect(stats.todo).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.progress).toBe(25);
    expect(stats.unassigned).toBe(1);
    expect(stats.completedLast7Days).toBe(1);
    expect(stats.workload[0]).toEqual({ name: "Alex", open: 2, overdue: 1 });
  });

  it("handles an empty project", () => {
    const stats = computeStats(project([]), today);
    expect(stats.total).toBe(0);
    expect(stats.progress).toBe(0);
    expect(stats.workload).toEqual([]);
  });
});

describe("risk detection", () => {
  it("flags overdue, blocked and stale tasks", () => {
    const result = localRisks(
      project([
        task({ title: "Ship the release", status: "TODO", dueDate: new Date(today.getTime() - 9 * DAY), priority: "URGENT" }),
        task({ title: "Blocked: waiting on vendor API keys", status: "TODO", dueDate: new Date(today.getTime() + 4 * DAY) }),
        task({ title: "Refactor the sync worker", status: "IN_PROGRESS", updatedAt: new Date(today.getTime() - 20 * DAY) }),
      ]),
      today,
    );

    const kinds = (result.risks ?? []).map((risk) => risk.kind);
    expect(kinds).toContain("overdue");
    expect(kinds).toContain("blocked");
    expect(kinds).toContain("stale");
    expect(result.risks?.[0].severity).toBe("critical");
  });

  it("reports a clean bill of health when nothing is wrong", () => {
    const result = localRisks(
      project([task({ status: "IN_PROGRESS", dueDate: new Date(today.getTime() + 5 * DAY) })]),
      today,
    );
    expect(result.risks ?? []).toHaveLength(0);
    expect(result.summary).toMatch(/No overdue, blocked or stalled/i);
  });
});

describe("priority suggestions", () => {
  it("scores overdue urgent work above healthy work", () => {
    const overdue = task({
      title: "Fix production outage",
      dueDate: new Date(today.getTime() - 2 * DAY),
      priority: "HIGH",
    });
    const healthy = task({ title: "Update the style guide", dueDate: new Date(today.getTime() + 20 * DAY) });
    const proj = project([overdue, healthy]);

    const overdueScore = scoreTask(overdue, proj, today).score;
    const healthyScore = scoreTask(healthy, proj, today).score;

    expect(overdueScore).toBeGreaterThan(healthyScore);
    expect(overdueScore).toBeGreaterThanOrEqual(40);

    const result = localPriorities(proj, today);
    expect(result.prioritySuggestions?.[0].taskId).toBe(overdue.id);
    expect(result.prioritySuggestions?.[0].suggestedPriority).toBe("URGENT");
  });

  it("ignores completed tasks", () => {
    const result = localPriorities(
      project([task({ status: "DONE", completedAt: today }), task({ status: "TODO" })]),
      today,
    );
    expect(result.prioritySuggestions).toHaveLength(1);
  });
});

describe("task breakdown", () => {
  it("splits a compound brief into atomic imperative tasks", () => {
    const result = localBreakdown(
      project([]),
      "research competitor flows, design three onboarding screens, build the API endpoint for progress sync, write automated tests, update the documentation and deploy to the app stores",
    );

    const titles = (result.suggestions ?? []).map((suggestion) => suggestion.title);
    expect(titles.length).toBeGreaterThanOrEqual(5);
    expect(titles.some((title) => /^Research competitor flows/.test(title))).toBe(true);
    expect(titles.some((title) => /^Design three onboarding screens/.test(title))).toBe(true);
    expect(titles.every((title) => title.length <= 100)).toBe(true);
    expect(titles.every((title) => !title.endsWith("…"))).toBe(true);
  });

  it("handles bullet lists and strips filler words", () => {
    const result = localBreakdown(
      project([]),
      "- Please also redesign the pricing page\n- We need to migrate the blog content\n- Set up CI for preview deployments",
    );
    const titles = (result.suggestions ?? []).map((suggestion) => suggestion.title);
    expect(titles).toContain("Redesign the pricing page");
    expect(titles).toContain("Migrate the blog content");
    expect(titles).toContain("Set up CI for preview deployments");
  });

  it("always produces a task list, even without a brief", () => {
    const result = localBreakdown(project([]), "");
    expect(result.suggestions?.length).toBeGreaterThan(0);
    expect(result.suggestions?.every((suggestion) => suggestion.title.length > 3)).toBe(true);
  });

  it("assigns urgent priority to defect language", () => {
    const result = localBreakdown(project([]), "fix the crash when uploading files, design the empty state");
    const fix = result.suggestions?.find((suggestion) => /crash/i.test(suggestion.title));
    expect(fix?.priority).toBe("URGENT");
  });
});

describe("summary and report", () => {
  const proj = project([
    task({ status: "DONE", completedAt: new Date(today.getTime() - DAY) }),
    task({ status: "IN_PROGRESS", dueDate: new Date(today.getTime() + DAY) }),
    task({ status: "TODO", dueDate: new Date(today.getTime() - DAY) }),
  ]);

  it("summarises progress and highlights overdue work", () => {
    const result = localSummary(proj, today, [{ message: "created project", createdAt: today }]);
    expect(result.summary).toMatch(/Website Redesign/);
    expect(result.bullets.join(" ")).toMatch(/past due/i);
    expect(result.stats.some((stat) => stat.label === "Progress")).toBe(true);
  });

  it("produces a structured status report", () => {
    const result = localReport(proj, today);
    expect(result.markdown).toContain("## Status report — Website Redesign");
    expect(result.markdown).toContain("### Progress");
    expect(result.markdown).toContain("### Recommended next actions");
  });
});
