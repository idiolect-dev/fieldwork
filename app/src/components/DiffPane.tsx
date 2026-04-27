import { useState } from "react";
import { useWorkspaceStore } from "../workspace/store";
import type { Draft } from "../workspace/types";

interface Props {
  draft: Draft | null;
}

interface Change {
  /** Dotted path into the body; nested array indices show as `[i]`. */
  path: string;
  /** Stringified `original` for the path. */
  before: string | null;
  /** Stringified `current` for the path. `null` when the field was deleted. */
  after: string | null;
  /** What kind of change. */
  kind: "added" | "removed" | "modified";
}

/**
 * "What's changed since import" pane.
 *
 * Walks the original snapshot vs. the current body and emits one
 * `Change` per leaf-level modification. Lives next to the form so
 * the user can see at a glance which fields they've touched.
 *
 * No diff for fresh drafts (no original to compare against). The
 * pane shows a "Snapshot current state" button that calls
 * `snapshotDraft` so the user can stake out a new baseline.
 */
export function DiffPane({ draft }: Props) {
  const original = useWorkspaceStore((s) =>
    draft ? s.originals[draft.body.id] : undefined,
  );
  const snapshotDraft = useWorkspaceStore((s) => s.snapshotDraft);
  const [collapsed, setCollapsed] = useState(true);

  if (!draft) return null;

  const current = draft.body.body as unknown;
  const changes = original !== undefined ? diff(original, current) : null;
  const hasChanges = changes !== null && changes.length > 0;

  return (
    <div className="border border-stone-200 rounded mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        <span>
          {original === undefined
            ? "Diff vs. baseline (no baseline)"
            : hasChanges
              ? `Diff vs. baseline (${changes.length} change${changes.length === 1 ? "" : "s"})`
              : "Diff vs. baseline (no changes)"}
        </span>
        <span className="text-xs text-stone-500">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="p-3 border-t border-stone-200 text-xs">
          {original === undefined ? (
            <>
              <p className="text-stone-600 mb-2">
                This draft has no baseline snapshot; it was created
                from scratch rather than imported. Stake out a
                baseline to enable diffing.
              </p>
              <button
                type="button"
                onClick={() => snapshotDraft(draft.body.id)}
                className="px-2 py-1 rounded border border-stone-300 text-stone-700"
              >
                Snapshot current state as baseline
              </button>
            </>
          ) : !hasChanges ? (
            <p className="text-stone-600">
              No changes since the baseline was taken.
            </p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="text-stone-500 text-left">
                  <tr>
                    <th className="font-medium">field</th>
                    <th className="font-medium">before</th>
                    <th className="font-medium">after</th>
                  </tr>
                </thead>
                <tbody>
                  {changes!.map((c) => (
                    <tr
                      key={c.path}
                      className="border-t border-stone-100 align-top"
                    >
                      <td className="font-mono pr-2 py-1">{c.path}</td>
                      <td className="font-mono pr-2 py-1 text-red-700 break-all">
                        {c.before ?? <em className="text-stone-400">(empty)</em>}
                      </td>
                      <td className="font-mono py-1 text-emerald-800 break-all">
                        {c.after ?? <em className="text-stone-400">(empty)</em>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() => snapshotDraft(draft.body.id)}
                className="mt-3 px-2 py-1 rounded border border-stone-300 text-stone-700"
              >
                Promote current state to baseline
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Recursive structural diff. Emits leaf-level changes only; objects
 * and arrays are descended into rather than reported as a single
 * "modified" line. This is a deliberately simple implementation
 * tuned for record-shaped JSON; not a general-purpose diff.
 */
function diff(a: unknown, b: unknown, prefix = ""): Change[] {
  if (a === b) return [];
  if (sameKind(a, b)) {
    if (isObject(a) && isObject(b)) {
      const out: Change[] = [];
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of [...keys].sort()) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (!(k in a)) {
          out.push({
            path,
            before: null,
            after: render((b as Record<string, unknown>)[k]),
            kind: "added",
          });
        } else if (!(k in b)) {
          out.push({
            path,
            before: render((a as Record<string, unknown>)[k]),
            after: null,
            kind: "removed",
          });
        } else {
          out.push(
            ...diff(
              (a as Record<string, unknown>)[k],
              (b as Record<string, unknown>)[k],
              path,
            ),
          );
        }
      }
      return out;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const out: Change[] = [];
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        const path = `${prefix}[${i}]`;
        if (i >= a.length) {
          out.push({
            path,
            before: null,
            after: render(b[i]),
            kind: "added",
          });
        } else if (i >= b.length) {
          out.push({
            path,
            before: render(a[i]),
            after: null,
            kind: "removed",
          });
        } else {
          out.push(...diff(a[i], b[i], path));
        }
      }
      return out;
    }
  }
  // Both leaves but different, or kind-mismatch.
  return [
    {
      path: prefix || "(root)",
      before: render(a),
      after: render(b),
      kind: "modified",
    },
  ];
}

function sameKind(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return Array.isArray(b);
  if (isObject(a)) return isObject(b);
  return typeof a === typeof b;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return (
    typeof x === "object" && x !== null && !Array.isArray(x)
  );
}

function render(x: unknown): string {
  if (x === undefined) return "undefined";
  if (x === null) return "null";
  if (typeof x === "string") return JSON.stringify(x);
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  return JSON.stringify(x);
}
