import type { Metadata, Viewport } from "next";

import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TaskFlow AI — AI project & task management for small teams",
    template: "%s · TaskFlow AI",
  },
  description:
    "TaskFlow AI keeps small teams shipping: projects, tasks, team roles and an AI assistant that summarises progress, breaks down work and flags blockers.",
  applicationName: "TaskFlow AI",
  keywords: ["project management", "task management", "AI assistant", "team collaboration"],
  authors: [{ name: "TaskFlow AI" }],
  openGraph: {
    title: "TaskFlow AI",
    description: "AI-powered project and task management for small teams.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#080c17" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the stored theme before first paint so there is no flash of the
 * wrong colour scheme. Falls back to the OS preference.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("taskflow-theme");
    var theme = stored || "system";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = theme === "dark" || (theme === "system" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
