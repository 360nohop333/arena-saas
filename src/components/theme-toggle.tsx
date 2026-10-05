"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { callAction } from "@/lib/client-action";
import type { ThemePreference } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "taskflow-theme";

function applyTheme(theme: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/**
 * Persists the theme in localStorage (instant, no flash) and, when the user is
 * signed in, syncs it to their profile so it follows them across devices.
 */
export function useTheme(initial: ThemePreference = "system", persist = true) {
  const [theme, setTheme] = useState<ThemePreference>(initial);

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const update = useCallback(
    async (next: ThemePreference) => {
      setTheme(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);

      if (persist) {
        // Fire and forget: the UI already reflects the choice.
        await callAction("settings.updateTheme", { theme: next });
      }
    },
    [persist],
  );

  const cycle = useCallback(() => {
    const order: ThemePreference[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    void update(next);
  }, [theme, update]);

  return { theme, setTheme: update, cycle };
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${option.label} theme`}
            onClick={() => void setTheme(option.value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition",
              active
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{option.label} theme</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeIconToggle({ className }: { className?: string }) {
  const { theme, cycle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-surface-muted hover:text-foreground",
        className,
      )}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Sun className={cn("size-4", dark ? "hidden" : "block")} aria-hidden />
      <Moon className={cn("size-4", dark ? "block" : "hidden")} aria-hidden />
    </button>
  );
}
