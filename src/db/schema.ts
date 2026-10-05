import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

/**
 * TaskFlow AI — database schema (Drizzle ORM / SQLite-compatible SQL).
 *
 * Storage notes
 * -------------
 * • IDs are opaque strings (`prefix_uuid`) so rows stay portable and readable.
 * • Timestamps are stored as INTEGER milliseconds (`mode: "timestamp_ms"`) which
 *   maps to a JS `Date` automatically.
 * • Enum-like columns are TEXT with a documented value set, validated in the
 *   application layer (src/lib/validation.ts). This keeps the schema portable
 *   between SQLite/Turso and Postgres.
 */

const now = () => new Date();

export const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 22)}`;

/* -------------------------------------------------------------------------- */
/*                                    Users                                    */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => id("usr")),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarColor: text("avatar_color").notNull().default("#6366f1"),
    jobTitle: text("job_title"),
    timezone: text("timezone").notNull().default("UTC"),
    themePreference: text("theme_preference").notNull().default("system"),
    emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(true),
    pushNotifications: integer("push_notifications", { mode: "boolean" }).notNull().default(false),
    weeklyDigest: integer("weekly_digest", { mode: "boolean" }).notNull().default(true),
    dueDateReminders: integer("due_date_reminders", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => id("ses")),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey().$defaultFn(() => id("prt")),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                            Workspaces & membership                          */
/* -------------------------------------------------------------------------- */

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => id("wsp")),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("workspaces_slug_unique").on(table.slug)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey().$defaultFn(() => id("mem")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"), // OWNER | ADMIN | MEMBER
    title: text("title"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("memberships_workspace_user_unique").on(table.workspaceId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey().$defaultFn(() => id("inv")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("MEMBER"),
    token: text("token").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING | ACCEPTED | REVOKED
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("invites_token_unique").on(table.token),
    index("invites_workspace_email_idx").on(table.workspaceId, table.email),
  ],
);

/* -------------------------------------------------------------------------- */
/*                             Projects & tasks                                */
/* -------------------------------------------------------------------------- */

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(() => id("prj")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"), // PLANNING | ACTIVE | ON_HOLD | COMPLETED | ARCHIVED
    color: text("color").notNull().default("#6366f1"),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("projects_workspace_idx").on(table.workspaceId),
    index("projects_status_idx").on(table.status),
  ],
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey().$defaultFn(() => id("pmb")),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("project_members_unique").on(table.projectId, table.userId),
    index("project_members_user_idx").on(table.userId),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => id("tsk")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("MEDIUM"), // LOW | MEDIUM | HIGH | URGENT
    status: text("status").notNull().default("TODO"), // TODO | IN_PROGRESS | REVIEW | DONE
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("tasks_workspace_idx").on(table.workspaceId),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_assignee_idx").on(table.assigneeId),
    index("tasks_status_idx").on(table.status),
    index("tasks_due_idx").on(table.dueDate),
  ],
);

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey().$defaultFn(() => id("act")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("activities_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("activities_project_idx").on(table.projectId),
  ],
);

export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => id("air")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    prompt: text("prompt").notNull().default(""),
    output: text("output").notNull(),
    provider: text("provider").notNull().default("local"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("ai_runs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("ai_runs_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                            Relations (for joins)                            */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  memberships: many(memberships),
  projectMemberships: many(projectMembers),
  assignedTasks: many(tasks),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  memberships: many(memberships),
  projects: many(projects),
  invites: many(invites),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [memberships.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  members: many(projectMembers),
  tasks: many(tasks),
  activities: many(activities),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [tasks.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id] }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  workspace: one(workspaces, { fields: [activities.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [activities.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [activities.taskId], references: [tasks.id] }),
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
}));

/* -------------------------------------------------------------------------- */
/*                              Inferred types                                 */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
