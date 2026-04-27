// Lens upload + index for fieldwork.
//
// Panproto lenses are typically authored in protolab and end up as
// JSON documents with a {$type: dev.panproto.schema.lens, ...}
// shape. Fieldwork doesn't *author* lenses (the editing surface
// lives in protolab) but it can publish a lens body to the active
// session's PDS, so dialect / recommendation drafts can reference
// it via at-uri.
//
// The page has two parts:
// - Your published lenses: live list of dev.panproto.schema.lens
//   records in the active session's repo. Each row exposes the
//   at-uri so it can be copied / pasted into a dialect's preferred
//   lenses or a recommendation's lens path.
// - Upload from protolab: paste lens JSON or pick a file. We do a
//   structural sanity check, then publish to the user's PDS via
//   the existing OAuth-bound agent.

import { useMemo, useState } from "react";
import { useSessionsStore } from "../sessions/store";
import { publishLens } from "../sessions/publishLens";
import { usePdsRefresh } from "../sessions/pdsRefresh";
import { WalkthroughTrigger } from "../components/WalkthroughTrigger";

const LENS_NSID = "dev.panproto.schema.lens";

export function LensManager() {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const session = activeDid ? sessions[activeDid] : null;

  const [pasted, setPasted] = useState("");
  const [rkey, setRkey] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUri, setPublishedUri] = useState<string | null>(null);
  const bumpPds = usePdsRefresh((s) => s.bump);

  const parsed = useMemo<{ ok: boolean; body?: Record<string, unknown>; error?: string }>(() => {
    if (!pasted.trim()) return { ok: false, error: "Paste a lens JSON body or load a file." };
    try {
      const value = JSON.parse(pasted);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, error: "Lens body must be a JSON object." };
      }
      return { ok: true, body: value as Record<string, unknown> };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [pasted]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setPasted(text);
  }

  async function doPublish() {
    if (!parsed.ok || !parsed.body) return;
    setPublishing(true);
    setPublishError(null);
    setPublishedUri(null);
    try {
      const result = await publishLens(parsed.body, rkey || undefined);
      setPublishedUri(result.uri);
      bumpPds();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="px-4 sm:px-8 py-6 overflow-auto h-full">
     <div className="max-w-3xl mx-auto">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Lens Manager</h2>
          <WalkthroughTrigger flow="lens" />
        </div>
        <p className="text-sm text-stone-600">
          Author lenses in{" "}
          <a
            href="https://panproto.dev/protolab"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            protolab
          </a>
          , then upload them here so your dialect and recommendation
          drafts can reference them.
        </p>
      </header>

      <section data-walk="lens-upload">
        <h3 className="font-semibold mb-2">Upload from protolab</h3>
        <p className="text-xs text-stone-600 mb-3">
          Paste the lens body JSON below, or load a `.json` file. The
          body publishes as a `{LENS_NSID}` record under the active
          session's repo.
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="text-xs"
          />
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={12}
            placeholder='{"$type":"dev.panproto.schema.lens", "...": "..."}'
            spellCheck={false}
            className="w-full px-3 py-2 border border-stone-300 rounded font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-600">
              rkey (optional)
            </label>
            <input
              type="text"
              value={rkey}
              onChange={(e) => setRkey(e.target.value)}
              placeholder="auto-generate"
              className="flex-1 px-2 py-1 border border-stone-300 rounded font-mono text-xs"
            />
          </div>
          {!parsed.ok && pasted.trim() && (
            <p className="text-xs text-red-700 font-mono">{parsed.error}</p>
          )}
          {parsed.ok && (
            <p className="text-xs text-emerald-700">
              Parses as a JSON object; ready to publish.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!parsed.ok || !session || publishing}
              onClick={doPublish}
              className="px-3 py-1 rounded bg-stone-900 text-white text-sm disabled:bg-stone-400"
            >
              {publishing ? "Publishing…" : "Publish to my PDS"}
            </button>
            {!session && (
              <span className="text-xs text-stone-500">Sign in first.</span>
            )}
            {publishError && (
              <span className="text-xs text-red-700">{publishError}</span>
            )}
            {publishedUri && (
              <span className="text-xs text-emerald-700 font-mono">
                published: {publishedUri}
              </span>
            )}
          </div>
        </div>
      </section>
     </div>
    </div>
  );
}

