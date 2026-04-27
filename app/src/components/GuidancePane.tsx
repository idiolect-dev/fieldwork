import { useEffect, useState } from "react";
import type { Draft, Guidance } from "../workspace/types";
import { useWorkspaceStore } from "../workspace/store";
import { wasm } from "../wasm/loader";
import { validateRecord } from "../panproto/validate";

const SEVERITY_STYLE = {
  info: "border-stone-300 bg-white text-stone-700",
  hint: "border-amber-300 bg-amber-50 text-amber-900",
  warning: "border-red-400 bg-red-50 text-red-900",
} as const;

export function GuidancePane({ draft }: { draft: Draft | null }) {
  const [guidance, setGuidance] = useState<Guidance>({ items: [] });
  const drafts = useWorkspaceStore((s) => s.drafts);
  const draftOrder = useWorkspaceStore((s) => s.draftOrder);

  useEffect(() => {
    if (!draft) {
      setGuidance({ items: [] });
      return;
    }
    try {
      // Cross-draft variant: walk references against the workspace
      // so the user sees when their recommendation cites a community
      // they're also editing in this session.
      const workspaceShape = {
        drafts: Object.fromEntries(
          draftOrder
            .map((id) => drafts[id])
            .filter((d): d is Draft => d !== undefined)
            .map((d) => [d.body.id, d]),
        ),
      };
      // No published-uri tracking yet; once publish lands we'll
      // pass the post-publish at-uris here.
      const publishedUris: Record<string, string> = {};
      const result = wasm().guidanceForInWorkspace(
        draft,
        workspaceShape,
        publishedUris,
      ) as Guidance;
      setGuidance(result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("guidanceForInWorkspace failed", e);
      setGuidance({ items: [] });
    }
  }, [draft, drafts, draftOrder]);

  // Lexicon validation runs in pure JS; cheap enough to do
  // synchronously on every render.
  const validation = draft
    ? validateRecord(
        draft.kind,
        draft.body.body,
      )
    : null;

  return (
    <aside className="md:w-80 md:border-l md:border-stone-200 bg-stone-50 px-4 py-4 overflow-auto border-t md:border-t-0 border-stone-200 md:shrink-0">
      <h3 className="font-semibold tracking-tight text-stone-700 text-sm mb-3">
        Guidance
      </h3>
      {!draft ? (
        <p className="text-sm text-stone-500">
          No draft selected. Pick or create one to see how it'll
          land downstream.
        </p>
      ) : (
        <>
          {validation && (
            <div
              className={`mb-3 px-3 py-2 rounded border text-xs ${
                validation.ok
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-400 bg-red-50 text-red-900"
              }`}
            >
              <div className="font-semibold mb-0.5">
                {validation.ok
                  ? "Valid against the lexicon"
                  : "Lexicon validation failed"}
              </div>
              {!validation.ok && (
                <pre className="whitespace-pre-wrap font-mono text-[11px] mt-1">
                  {validation.error}
                </pre>
              )}
            </div>
          )}
          {guidance.items.length === 0 ? (
            <p className="text-sm text-stone-500">
              Nothing to flag; your draft looks complete.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {guidance.items.map((item, i) => (
                <li
                  key={i}
                  className={`border rounded px-3 py-2 ${SEVERITY_STYLE[item.severity]}`}
                >
                  <div className="font-semibold mb-1">{item.headline}</div>
                  <p className="leading-snug">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
