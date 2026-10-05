import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn, initials } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   Avatar                                    */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? "#6366f1" }}
      title={name}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
}: {
  people: { name: string; color?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          color={person.color}
          size="xs"
          className={index === 0 ? "" : "-ml-2"}
        />
      ))}
      {extra > 0 ? (
        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-surface">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Progress                                   */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  className,
  label,
  tone = "primary",
}: {
  value: number;
  className?: string;
  label?: string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tones = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  } as const;

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Skeleton                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-1/2" />
      <Skeleton className="mt-4 h-2 w-full" />
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Empty / error states                            */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger-soft/50 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle className="size-6 text-danger" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-semibold transition hover:bg-surface-muted"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Alert                                     */
/* -------------------------------------------------------------------------- */

const ALERT_STYLES = {
  info: "border-info/30 bg-info-soft/60 text-foreground",
  success: "border-success/30 bg-success-soft/60 text-foreground",
  warning: "border-warning/35 bg-warning-soft/60 text-foreground",
  danger: "border-danger/35 bg-danger-soft/60 text-foreground",
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_STYLES;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cn("rounded-lg border px-4 py-3 text-sm", ALERT_STYLES[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn("text-muted-foreground", title && "mt-0.5")}>{children}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Table                                     */
/* -------------------------------------------------------------------------- */

export function TableWrapper({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("w-full overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-border/70 px-4 py-3 align-middle", className)} {...props}>
      {children}
    </td>
  );
}
