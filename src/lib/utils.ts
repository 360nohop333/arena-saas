import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Priority, ProjectStatus, Role, TaskStatus } from "@/lib/constants";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
];

/** Deterministic avatar colour so a user always looks the same. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as Priority] ?? priority;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TaskStatus] ?? status;
}

export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

/** Signed percentage of completed work for a set of tasks. */
export function completionRate(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === "DONE").length;
  return Math.round((done / tasks.length) * 100);
}

export function truncate(value: string, max = 140): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

/** Progress bar segments for the dashboard's status breakdown. */
export function groupCount<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** First validation message for a field, used for aria-describedby wiring. */
export function errorId(field: string): string {
  return `${field}-error`;
}
