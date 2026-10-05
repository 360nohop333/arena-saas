"use client";

import { useCallback, useState } from "react";

import type { ActionResult } from "@/lib/validation";
import type { CommandName } from "@/server/commands";

/**
 * Calls a server command over the typed JSON endpoint.
 *
 * Never throws for expected failures: form components get a uniform
 * `ActionResult` back and can render field errors / toasts consistently.
 */
export async function callAction<T = unknown>(
  name: CommandName,
  input: unknown = {},
): Promise<ActionResult<T>> {
  try {
    const response = await fetch(`/api/actions/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
      credentials: "same-origin",
    });

    const payload = (await response.json().catch(() => null)) as ActionResult<T> | null;

    if (!payload) {
      return { ok: false, error: `Unexpected response (${response.status}).`, code: "INTERNAL" };
    }
    return payload;
  } catch {
    return {
      ok: false,
      error: "Network error — check your connection and try again.",
      code: "INTERNAL",
    };
  }
}

export type SubmitState = {
  pending: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
};

/**
 * Small helper that wraps `callAction` with pending/error state for forms.
 *
 *   const submit = useSubmit();
 *   const onSubmit = (event) => submit.run(event, async () => callAction(...));
 */
export function useSubmit() {
  const [state, setState] = useState<SubmitState>({ pending: false, error: null, fieldErrors: {} });

  const reset = useCallback(() => setState({ pending: false, error: null, fieldErrors: {} }), []);

  const run = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
      options: { onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void } = {},
    ): Promise<ActionResult<T> | null> => {
      setState({ pending: true, error: null, fieldErrors: {} });
      const result = await action();

      if (result.ok) {
        setState({ pending: false, error: null, fieldErrors: {} });
        options.onSuccess?.(result as Extract<ActionResult<T>, { ok: true }>);
      } else {
        setState({
          pending: false,
          error: result.error,
          fieldErrors: result.fieldErrors ?? {},
        });
      }

      return result;
    },
    [],
  );

  return { ...state, run, reset, setState };
}
