/**
 * Seed TaskFlow AI with a realistic demo workspace.
 *
 * Idempotent: re-running removes the previous demo workspace for the demo
 * account and rebuilds it, so `npm run db:seed` is safe to repeat.
 *
 *   npm run db:seed
 */

import "dotenv/config";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  activities,
  aiRuns,
  invites,
  memberships,
  projectMembers,
  projects,
  tasks,
  users,
  workspaces,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { generateToken, inviteExpiry } from "@/lib/tokens";
import type { Priority, ProjectStatus, Role, TaskStatus } from "@/lib/constants";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@taskflow.ai";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo1234!";
const WORKSPACE_SLUG = "northwind-studio";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * DAY);
const ago = (n: number) => new Date(now.getTime() - n * DAY);
/** Date at midday so timezone shifts never move the calendar day. */
const day = (n: number) => {
  const date = days(n);
  date.setHours(12, 0, 0, 0);
  return date;
};

type SeedUser = {
  email: string;
  name: string;
  role: Role;
  title: string;
  avatarColor: string;
  timezone: string;
  joinedDaysAgo: number;
};

const SEED_USERS: SeedUser[] = [
  {
    email: DEMO_EMAIL,
    name: "Alex Morgan",
    role: "OWNER",
    title: "Head of Product",
    avatarColor: "#6366f1",
    timezone: "Europe/London",
    joinedDaysAgo: 120,
  },
  {
    email: "maya.chen@taskflow.ai",
    name: "Maya Chen",
    role: "ADMIN",
    title: "Design Lead",
    avatarColor: "#ec4899",
    timezone: "Europe/London",
    joinedDaysAgo: 96,
  },
  {
    email: "tom.reyes@taskflow.ai",
    name: "Tom Reyes",
    role: "MEMBER",
    title: "Backend Engineer",
    avatarColor: "#0ea5e9",
    timezone: "America/New_York",
    joinedDaysAgo: 88,
  },
  {
    email: "priya.nair@taskflow.ai",
    name: "Priya Nair",
    role: "MEMBER",
    title: "Product Manager",
    avatarColor: "#14b8a6",
    timezone: "Asia/Kolkata",
    joinedDaysAgo: 74,
  },
  {
    email: "leo.martin@taskflow.ai",
    name: "Leo Martin",
    role: "MEMBER",
    title: "QA Engineer",
    avatarColor: "#f59e0b",
    timezone: "Europe/Berlin",
    joinedDaysAgo: 51,
  },
];

type SeedProject = {
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  deadline: Date | null;
  createdDaysAgo: number;
  members: string[]; // emails
};

const SEED_PROJECTS: SeedProject[] = [
  {
    key: "website",
    name: "Website Redesign",
    description:
      "Rebuild the marketing site on the new design system: refreshed brand, faster pages, and a self-serve pricing page. Success means a 20% lift in trial signups and Lighthouse scores above 95.",
    status: "ACTIVE",
    color: "#6366f1",
    deadline: day(21),
    createdDaysAgo: 42,
    members: [
      DEMO_EMAIL,
      "maya.chen@taskflow.ai",
      "priya.nair@taskflow.ai",
      "leo.martin@taskflow.ai",
    ],
  },
  {
    key: "mobile",
    name: "Mobile App v2.0",
    description:
      "Ship offline mode, push notifications and a redesigned onboarding flow for the iOS and Android apps. Blocked items must be escalated in the weekly sync.",
    status: "ACTIVE",
    color: "#0ea5e9",
    deadline: day(9),
    createdDaysAgo: 63,
    members: [DEMO_EMAIL, "tom.reyes@taskflow.ai", "leo.martin@taskflow.ai"],
  },
  {
    key: "marketing",
    name: "Q4 Marketing Campaign",
    description:
      "Plan and launch the Q4 campaign: positioning, landing page, webinar series and the customer case study. Needs a clear content calendar before the end of the month.",
    status: "PLANNING",
    color: "#f59e0b",
    deadline: day(34),
    createdDaysAgo: 18,
    members: [DEMO_EMAIL, "priya.nair@taskflow.ai", "maya.chen@taskflow.ai"],
  },
];

type SeedTask = {
  project: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  due: number | null; // days from today
  assignee: string | null; // email
  createdDaysAgo: number;
  completedDaysAgo?: number;
};

const SEED_TASKS: SeedTask[] = [
  /* ------------------------------- website ------------------------------- */
  {
    project: "website",
    title: "Design the new pricing page",
    description: "Three tiers, annual toggle, FAQ block and a clear comparison table. Include the enterprise contact route.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due: 3,
    assignee: "maya.chen@taskflow.ai",
    createdDaysAgo: 21,
  },
  {
    project: "website",
    title: "Migrate blog content to the new CMS",
    description: "Move 84 posts, keep slugs intact and add redirects for the 12 renamed URLs.",
    status: "TODO",
    priority: "MEDIUM",
    due: 12,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 17,
  },
  {
    project: "website",
    title: "Fix mobile navigation regression",
    description: "The hamburger menu does not close on iOS Safari 17. Reported by three customers this week.",
    status: "REVIEW",
    priority: "URGENT",
    due: -2,
    assignee: "leo.martin@taskflow.ai",
    createdDaysAgo: 9,
  },
  {
    project: "website",
    title: "Improve Core Web Vitals (LCP under 2s)",
    description: "Optimise hero images, defer third-party scripts and add font preloading.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due: 6,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 15,
  },
  {
    project: "website",
    title: "Write homepage copy v2",
    description: "Sharpen the value proposition: lead with time saved, not feature lists.",
    status: "DONE",
    priority: "MEDIUM",
    due: -4,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 30,
    completedDaysAgo: 3,
  },
  {
    project: "website",
    title: "Accessibility audit (WCAG 2.2 AA)",
    description: "Contrast, focus order, landmark roles and screen reader passes on the top five pages.",
    status: "TODO",
    priority: "HIGH",
    due: 15,
    assignee: "maya.chen@taskflow.ai",
    createdDaysAgo: 11,
  },
  {
    project: "website",
    title: "Set up analytics events for the signup funnel",
    description: "Track landing → pricing → signup with UTM attribution.",
    status: "DONE",
    priority: "MEDIUM",
    due: -8,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 26,
    completedDaysAgo: 6,
  },

  /* -------------------------------- mobile ------------------------------- */
  {
    project: "mobile",
    title: "Implement offline sync queue",
    description: "Queue mutations locally and replay on reconnect with conflict resolution on the server.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    due: 2,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 24,
  },
  {
    project: "mobile",
    title: "Push notification permissions flow",
    description: "Ask in context after the first project is created, never on cold start.",
    status: "TODO",
    priority: "HIGH",
    due: 5,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 14,
  },
  {
    project: "mobile",
    title: "Blocked: waiting on vendor API keys for SMS fallback",
    description: "Waiting on the vendor security review before we can provision production keys. Escalated to Priya.",
    status: "TODO",
    priority: "HIGH",
    due: -1,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 19,
  },
  {
    project: "mobile",
    title: "Redesign onboarding (3 steps → 1)",
    description: "Collapse the onboarding wizard, add progress hints and allow skipping.",
    status: "REVIEW",
    priority: "MEDIUM",
    due: 1,
    assignee: "maya.chen@taskflow.ai",
    createdDaysAgo: 22,
  },
  {
    project: "mobile",
    title: "Release notes and store listing for v2.0",
    description: "Screenshots for both stores, What's New copy and the changelog for existing users.",
    status: "TODO",
    priority: "LOW",
    due: 8,
    assignee: null,
    createdDaysAgo: 6,
  },
  {
    project: "mobile",
    title: "Crash: session expires during background upload",
    description: "Reproduced on Android 14. Token refresh races with the upload worker.",
    status: "IN_PROGRESS",
    priority: "URGENT",
    due: -3,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 8,
  },
  {
    project: "mobile",
    title: "Regression suite for the offline flow",
    description: "Automate the 14 critical scenarios before the release candidate.",
    status: "TODO",
    priority: "HIGH",
    due: 4,
    assignee: "leo.martin@taskflow.ai",
    createdDaysAgo: 5,
  },
  {
    project: "mobile",
    title: "Instrument crash reporting dashboards",
    description: "Group by release channel and alert when the crash-free rate drops below 99.5%.",
    status: "DONE",
    priority: "MEDIUM",
    due: -10,
    assignee: "tom.reyes@taskflow.ai",
    createdDaysAgo: 28,
    completedDaysAgo: 2,
  },
  {
    project: "mobile",
    title: "App Store review preparation checklist",
    description: "Privacy manifest, data-collection disclosure and demo account for reviewers.",
    status: "DONE",
    priority: "LOW",
    due: -6,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 20,
    completedDaysAgo: 5,
  },

  /* ------------------------------- marketing ----------------------------- */
  {
    project: "marketing",
    title: "Define Q4 campaign narrative and positioning",
    description: "One page: audience, pain, promise, proof. Sign-off from product and sales.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due: 7,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 13,
  },
  {
    project: "marketing",
    title: "Build campaign landing page",
    description: "Reuse the pricing components from the website redesign. Needs a hero video slot.",
    status: "TODO",
    priority: "MEDIUM",
    due: 18,
    assignee: "maya.chen@taskflow.ai",
    createdDaysAgo: 10,
  },
  {
    project: "marketing",
    title: "Schedule webinar series (3 sessions)",
    description: "Speakers, dates and registration flow. Coordinate with the customer success team.",
    status: "TODO",
    priority: "MEDIUM",
    due: 22,
    assignee: null,
    createdDaysAgo: 4,
  },
  {
    project: "marketing",
    title: "Publish the Northwind customer case study",
    description: "Interview, 900-word story and a two-page PDF for sales enablement.",
    status: "TODO",
    priority: "LOW",
    due: 27,
    assignee: "priya.nair@taskflow.ai",
    createdDaysAgo: 3,
  },
];

type SeedActivity = {
  type: string;
  message: string;
  project?: string;
  actor?: string;
  hoursAgo: number;
};

const SEED_ACTIVITIES: SeedActivity[] = [
  { type: "task.completed", message: "completed task “Instrument crash reporting dashboards”", project: "mobile", actor: "tom.reyes@taskflow.ai", hoursAgo: 3 },
  { type: "task.updated", message: "moved “Design the new pricing page” to in progress", project: "website", actor: "maya.chen@taskflow.ai", hoursAgo: 6 },
  { type: "ai.generated", message: "ran the AI assistant (summary) on “Website Redesign”", project: "website", actor: DEMO_EMAIL, hoursAgo: 9 },
  { type: "task.created", message: "created task “Regression suite for the offline flow”", project: "mobile", actor: "leo.martin@taskflow.ai", hoursAgo: 20 },
  { type: "task.updated", message: "moved “Crash: session expires during background upload” to in progress", project: "mobile", actor: "tom.reyes@taskflow.ai", hoursAgo: 28 },
  { type: "member.joined", message: "Leo Martin joined the workspace", actor: "leo.martin@taskflow.ai", hoursAgo: 34 },
  { type: "task.completed", message: "completed task “App Store review preparation checklist”", project: "mobile", actor: "priya.nair@taskflow.ai", hoursAgo: 44 },
  { type: "project.created", message: "created project “Q4 Marketing Campaign”", project: "marketing", actor: DEMO_EMAIL, hoursAgo: 60 },
  { type: "task.completed", message: "completed task “Write homepage copy v2”", project: "website", actor: "priya.nair@taskflow.ai", hoursAgo: 72 },
  { type: "task.updated", message: "flagged “Fix mobile navigation regression” as urgent", project: "website", actor: "leo.martin@taskflow.ai", hoursAgo: 80 },
  { type: "member.invited", message: "invited sara.owens@northwind.io as member", actor: DEMO_EMAIL, hoursAgo: 92 },
  { type: "task.completed", message: "completed task “Set up analytics events for the signup funnel”", project: "website", actor: "tom.reyes@taskflow.ai", hoursAgo: 110 },
  { type: "project.updated", message: "updated project “Mobile App v2.0”", project: "mobile", actor: "priya.nair@taskflow.ai", hoursAgo: 126 },
  { type: "workspace.updated", message: "renamed the workspace to “Northwind Studio”", actor: DEMO_EMAIL, hoursAgo: 140 },
];

async function main() {
  console.log("🌱 Seeding TaskFlow AI demo data…");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  /* ------------------------- clean previous demo ------------------------- */
  const existingWorkspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);

  if (existingWorkspace[0]) {
    const workspaceId = existingWorkspace[0].id;
    // Explicit deletes keep this safe even if FK cascades are disabled.
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));
    const projectIds = projectRows.map((row) => row.id);

    await db.delete(aiRuns).where(eq(aiRuns.workspaceId, workspaceId));
    await db.delete(activities).where(eq(activities.workspaceId, workspaceId));
    await db.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
    if (projectIds.length) {
      await db.delete(projectMembers).where(inArray(projectMembers.projectId, projectIds));
      await db.delete(projects).where(inArray(projects.id, projectIds));
    }
    await db.delete(invites).where(eq(invites.workspaceId, workspaceId));
    await db.delete(memberships).where(eq(memberships.workspaceId, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    console.log("   • removed the previous demo workspace");
  }

  /* ------------------------------- users -------------------------------- */
  const userIds = new Map<string, string>();

  for (const seedUser of SEED_USERS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, seedUser.email))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          name: seedUser.name,
          passwordHash,
          avatarColor: seedUser.avatarColor,
          jobTitle: seedUser.title,
          timezone: seedUser.timezone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      userIds.set(seedUser.email, existing.id);
    } else {
      const [created] = await db
        .insert(users)
        .values({
          email: seedUser.email,
          name: seedUser.name,
          passwordHash,
          avatarColor: seedUser.avatarColor,
          jobTitle: seedUser.title,
          timezone: seedUser.timezone,
          themePreference: seedUser.email === DEMO_EMAIL ? "system" : "dark",
          createdAt: ago(seedUser.joinedDaysAgo),
        })
        .returning({ id: users.id });
      userIds.set(seedUser.email, created.id);
    }
  }

  const ownerId = userIds.get(DEMO_EMAIL)!;

  /* ----------------------------- workspace ------------------------------ */
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "Northwind Studio",
      slug: WORKSPACE_SLUG,
      ownerId,
      plan: "pro",
      createdAt: ago(120),
      updatedAt: ago(1),
    })
    .returning();

  for (const seedUser of SEED_USERS) {
    await db.insert(memberships).values({
      workspaceId: workspace.id,
      userId: userIds.get(seedUser.email)!,
      role: seedUser.role,
      title: seedUser.title,
      joinedAt: ago(seedUser.joinedDaysAgo),
    });
  }

  /* ------------------------------ projects ------------------------------ */
  const projectIds = new Map<string, string>();

  for (const seedProject of SEED_PROJECTS) {
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: workspace.id,
        name: seedProject.name,
        description: seedProject.description,
        status: seedProject.status,
        color: seedProject.color,
        deadline: seedProject.deadline,
        ownerId,
        createdAt: ago(seedProject.createdDaysAgo),
        updatedAt: ago(1),
      })
      .returning();

    projectIds.set(seedProject.key, project.id);

    for (const email of seedProject.members) {
      await db.insert(projectMembers).values({
        projectId: project.id,
        userId: userIds.get(email)!,
        addedAt: ago(seedProject.createdDaysAgo - 1),
      });
    }
  }

  /* -------------------------------- tasks ------------------------------- */
  const insertedTasks: { id: string; projectId: string; title: string }[] = [];

  for (const seedTask of SEED_TASKS) {
    const projectId = projectIds.get(seedTask.project)!;
    const createdAt = ago(seedTask.createdDaysAgo);
    const completedAt =
      seedTask.status === "DONE"
        ? ago(seedTask.completedDaysAgo ?? 1)
        : null;

    const [task] = await db
      .insert(tasks)
      .values({
        workspaceId: workspace.id,
        projectId,
        title: seedTask.title,
        description: seedTask.description,
        status: seedTask.status,
        priority: seedTask.priority,
        dueDate: seedTask.due === null ? null : day(seedTask.due),
        assigneeId: seedTask.assignee ? userIds.get(seedTask.assignee)! : null,
        createdById: seedTask.assignee ? userIds.get(seedTask.assignee)! : ownerId,
        completedAt,
        createdAt,
        updatedAt: completedAt ?? ago(Math.max(0, seedTask.createdDaysAgo - 4)),
      })
      .returning();

    insertedTasks.push({ id: task.id, projectId, title: task.title });
  }

  /* ------------------------------ activity ------------------------------ */
  for (const entry of SEED_ACTIVITIES) {
    await db.insert(activities).values({
      workspaceId: workspace.id,
      projectId: entry.project ? projectIds.get(entry.project)! : null,
      actorId: entry.actor ? userIds.get(entry.actor)! : null,
      type: entry.type,
      message: entry.message,
      createdAt: new Date(now.getTime() - entry.hoursAgo * 60 * 60 * 1000),
    });
  }

  /* ----------------------- invitation (pending demo) -------------------- */
  // Sara accepts her invite from the Team page to demonstrate the join flow.
  const [sara] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "sara.owens@northwind.io"))
    .limit(1);

  if (!sara) {
    await db.insert(users).values({
      email: "sara.owens@northwind.io",
      name: "Sara Owens",
      passwordHash,
      avatarColor: "#8b5cf6",
      jobTitle: "Content Strategist",
      timezone: "Europe/London",
      createdAt: ago(2),
    });
  }

  await db.insert(invites).values({
    workspaceId: workspace.id,
    email: "sara.owens@northwind.io",
    role: "MEMBER",
    token: generateToken(),
    status: "PENDING",
    invitedById: ownerId,
    expiresAt: inviteExpiry(new Date(), 14),
    createdAt: ago(2),
  });

  /* ------------------------- sample AI assist run ----------------------- */
  const websiteTasks = insertedTasks.filter((task) => task.projectId === projectIds.get("website"));
  const doneCount = SEED_TASKS.filter(
    (task) => task.project === "website" && task.status === "DONE",
  ).length;
  const progress = Math.round((doneCount / Math.max(websiteTasks.length, 1)) * 100);

  await db.insert(aiRuns).values({
    workspaceId: workspace.id,
    projectId: projectIds.get("website")!,
    kind: "summary",
    prompt: "",
    provider: "local",
    createdById: ownerId,
    createdAt: ago(0.4),
    output: JSON.stringify({
      kind: "summary",
      title: "Project summary — Website Redesign",
      summary: `${progress}% complete with ${websiteTasks.length - doneCount} of ${websiteTasks.length} tasks still open, including one overdue urgent fix.`,
      bullets: [
        `Delivery is on track — ${progress}% of the ${websiteTasks.length} tasks are complete.`,
        "One task is past due: the iOS Safari navigation regression should be shipped first.",
        "Design work on the pricing page is the current critical path.",
      ],
      markdown: `## Summary — Website Redesign\n\n${progress}% complete with ${websiteTasks.length - doneCount} of ${websiteTasks.length} tasks still open.\n\n### Signals\n- Pricing page design is the critical path\n- Mobile navigation regression is overdue and marked urgent\n- Core Web Vitals work is on schedule`,
      stats: [
        { label: "Progress", value: `${progress}%` },
        { label: "Open tasks", value: `${websiteTasks.length - doneCount}` },
        { label: "Overdue", value: "1" },
      ],
      provider: "local",
      generatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }),
  });

  console.log("✅ Seed complete");
  console.log(`   Workspace : Northwind Studio (${SEED_PROJECTS.length} projects)`);
  console.log(`   Tasks     : ${SEED_TASKS.length} (${SEED_TASKS.filter((t) => t.status === "DONE").length} done, ${SEED_TASKS.filter((t) => t.due !== null && t.due < 0 && t.status !== "DONE").length} overdue)`);
  console.log(`   Members   : ${SEED_USERS.length}`);
  console.log(`   Sign in   : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
