// Reusable confirm/dialog modal. Replaces window.confirm() across
// the app so we get consistent visual treatment, multi-option
// flows, and aria semantics.
//
// Two shapes:
// - <ConfirmModal>: imperative — caller controls `open` + supplies
//   `actions` (primary / secondary / tertiary). Each action runs and
//   closes the modal. Pass at most one `destructive` flag per action.
// - useConfirm(): hook that returns a `confirm(opts)` function
//   returning a Promise<string | null> resolving to the action key
//   the user picked, or null on cancel / Esc / click-outside.

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface ConfirmAction {
  /** Stable key returned via the hook's promise. */
  key: string;
  label: string;
  /** Highlight as the destructive primary (red). */
  destructive?: boolean;
  /** Highlight as the dark primary. */
  primary?: boolean;
}

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  actions: ConfirmAction[];
  /** Defaults to `Cancel`; pass null to omit. */
  cancelLabel?: string | null;
}

interface State extends ConfirmOptions {
  resolve: (key: string | null) => void;
}

let pending: State | null = null;
const subscribers = new Set<(s: State | null) => void>();

function publish(state: State | null) {
  pending = state;
  for (const fn of subscribers) fn(state);
}

/**
 * Imperative confirm; returns a promise resolving to the chosen
 * action key, or `null` for cancel. Mount <ConfirmHost /> once at
 * App root to render the modal.
 */
export function confirmAction(opts: ConfirmOptions): Promise<string | null> {
  return new Promise((resolve) => {
    publish({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [state, setState] = useState<State | null>(pending);

  useEffect(() => {
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  const close = useCallback((key: string | null) => {
    if (state) state.resolve(key);
    publish(null);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={() => close(null)}
      role="presentation"
    >
      <div
        className="bg-white border border-stone-200 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <header className="flex items-baseline justify-between px-5 pt-5 pb-2 gap-3">
          <h3 id="confirm-title" className="font-semibold text-stone-900">
            {state.title}
          </h3>
          <button
            type="button"
            onClick={() => close(null)}
            className="text-stone-500 hover:text-stone-900 text-lg leading-none px-1"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </header>
        {state.body && (
          <div className="px-5 pb-3 text-sm text-stone-700 leading-relaxed">
            {state.body}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2 px-5 pb-5 pt-3 border-t border-stone-100">
          {state.cancelLabel !== null && (
            <button
              type="button"
              onClick={() => close(null)}
              className="px-3 py-1 text-sm rounded text-stone-600"
            >
              {state.cancelLabel ?? "Cancel"}
            </button>
          )}
          {state.actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => close(a.key)}
              className={`px-3 py-1 text-sm rounded whitespace-nowrap ${
                a.destructive
                  ? "bg-red-700 text-white hover:bg-red-800"
                  : a.primary
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
