import { z } from "zod";

import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, THEMES } from "@/lib/constants";

/* -------------------------------------------------------------------------- */
/*                                  Primitives                                 */
/* -------------------------------------------------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be 80 characters or fewer");

/** Optional date coming from an `<input type="date">`. Empty string => null. */
export const optionalDateSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return null;
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
      return z.NEVER;
    }
    return date;
  });

export const cuidSchema = z.string().trim().min(1).max(64);
export const optionalIdSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value === "" || value === undefined ? null : value));

/* -------------------------------------------------------------------------- */
/*                                    Auth                                     */
/* -------------------------------------------------------------------------- */

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z.string().trim().max(80).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Reset link is invalid or expired"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/* -------------------------------------------------------------------------- */
/*                                  Projects                                   */
/* -------------------------------------------------------------------------- */

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(80, "Project name must be 80 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or fewer")
    .optional()
    .or(z.literal("")),
  status: projectStatusSchema.default("ACTIVE"),
  deadline: optionalDateSchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour")
    .default("#6366f1"),
  memberIds: z.array(cuidSchema).max(50).optional().default([]),
});

export const projectIdSchema = z.object({ projectId: cuidSchema });

/* -------------------------------------------------------------------------- */
/*                                    Tasks                                    */
/* -------------------------------------------------------------------------- */

export const prioritySchema = z.enum(PRIORITIES);
export const taskStatusSchema = z.enum(TASK_STATUSES);

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Task title must be at least 2 characters")
    .max(140, "Task title must be 140 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(4000, "Description must be 4000 characters or fewer")
    .optional()
    .or(z.literal("")),
  priority: prioritySchema.default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
  dueDate: optionalDateSchema,
  assigneeId: optionalIdSchema,
  projectId: cuidSchema,
});

export const taskUpdateSchema = taskSchema.partial().extend({ id: cuidSchema });

export const taskFilterSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  projectId: z.string().trim().optional().default("all"),
  status: z.union([taskStatusSchema, z.literal("all")]).optional().default("all"),
  priority: z.union([prioritySchema, z.literal("all")]).optional().default("all"),
  assigneeId: z.string().trim().optional().default("all"),
  due: z.enum(["all", "overdue", "today", "week", "none"]).optional().default("all"),
  sort: z
    .enum(["dueDate", "priority", "createdAt", "title", "status"])
    .optional()
    .default("dueDate"),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
});

export type TaskFilterInput = z.input<typeof taskFilterSchema>;

/* -------------------------------------------------------------------------- */
/*                                Team & settings                              */
/* -------------------------------------------------------------------------- */

export const inviteSchema = z.object({
  email: emailSchema,
  // A workspace has exactly one owner, so ownership is never granted by invite.
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  memberId: cuidSchema,
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const profileSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
  timezone: z.string().trim().max(60).optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(80, "Workspace name must be 80 characters or fewer"),
});

export const notificationSchema = z.object({
  emailNotifications: z.coerce.boolean().default(true),
  pushNotifications: z.coerce.boolean().default(false),
  weeklyDigest: z.coerce.boolean().default(true),
  dueDateReminders: z.coerce.boolean().default(true),
});

export const themeSchema = z.object({ theme: z.enum(THEMES) });

/* -------------------------------------------------------------------------- */
/*                                 AI assistant                                */
/* -------------------------------------------------------------------------- */

export const aiRequestSchema = z.object({
  projectId: cuidSchema,
  kind: z.enum(["summary", "breakdown", "priorities", "risks", "report"]),
  prompt: z.string().trim().max(4000).optional().default(""),
});

export type AiKind = z.infer<typeof aiRequestSchema>["kind"];

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                   */
/* -------------------------------------------------------------------------- */

export type FieldErrors = Record<string, string[]>;

/** Convert a ZodError into a `{ field: [message] }` map for form rendering. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; code?: ActionErrorCode; fieldErrors?: FieldErrors };

/** Parse FormData into an object, collapsing empty strings to undefined. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (key in entries) {
      const existing = entries[key];
      entries[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      entries[key] = value;
    }
  }
  return entries;
}
