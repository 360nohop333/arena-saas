import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiRuns } from "@/db/schema";
import { aiMode } from "@/lib/ai/provider";
import type { AiResponse } from "@/lib/ai/engine";

/**
 * Read model for the AI assistant panel: current provider, recent runs and
 * today's usage. Shared by the project page (initial render) and the
 * `ai.panel` command (refresh).
 */

export const AI_DAILY_LIMIT = 100;

export type AiPanelData = {
  mode: { remote: boolean; model: string };
  history: {
    id: string;
    kind: string;
    provider: string;
    prompt: string;
    createdAt: Date;
    output: AiResponse | null;
  }[];
  usage: { runsToday: number; dailyLimit: number };
};

export async function loadAiPanel(
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<AiPanelData> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [rows, usageRows] = await Promise.all([
    db
      .select()
      .from(aiRuns)
      .where(and(eq(aiRuns.workspaceId, workspaceId), eq(aiRuns.projectId, projectId)))
      .orderBy(desc(aiRuns.createdAt))
      .limit(5),
    db
      .select({ value: sql<number>`count(*)` })
      .from(aiRuns)
      .where(
        and(
          eq(aiRuns.workspaceId, workspaceId),
          eq(aiRuns.createdById, userId),
          gte(aiRuns.createdAt, startOfToday),
        ),
      ),
  ]);

  return {
    mode: aiMode(),
    history: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      provider: row.provider,
      prompt: row.prompt,
      createdAt: row.createdAt,
      output: safeParse(row.output),
    })),
    usage: {
      runsToday: Number(usageRows[0]?.value ?? 0),
      dailyLimit: AI_DAILY_LIMIT,
    },
  };
}

function safeParse(value: string): AiResponse | null {
  try {
    return JSON.parse(value) as AiResponse;
  } catch {
    return null;
  }
}
