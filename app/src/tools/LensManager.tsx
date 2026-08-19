// Lens library for fieldwork.
//
// Panproto lenses are authored in protolab, and as of protolab 0.8.0 they
// are published from protolab straight to the author's PDS. fieldwork used
// to accept a pasted lens JSON body and publish it here, which meant two
// apps writing the same collection, two copies of the publish path to keep
// in step, and a `repo:dev.panproto.schema.lens` grant fieldwork did not
// otherwise need. That upload is gone.
//
// What remains is the half fieldwork actually uses: a read-only view of the
// lenses in a repo, so a curator can copy an at-uri into a dialect's
// preferred lenses or a recommendation's lens path. Listing is a public
// unauthenticated read, so the library renders signed out and for any DID.

import { useCallback, useEffect, useState } from "react";
import { useSessionsStore } from "../sessions/store";
import {
  loadLensLibrary,
  PROTOLAB_URL,
  type LensWithSchemas,
} from "../sessions/lensLibrary";
import { WalkthroughTrigger } from "../components/WalkthroughTrigger";

const OPTIC_CLASS: Record<string, string> = {
  iso: "bg-emerald-50 text-emerald-800 border-emerald-300",
  retraction: "bg-amber-50 text-amber-800 border-amber-300",
  projection: "bg-orange-50 text-orange-800 border-orange-300",
  opaque: "bg-stone-100 text-stone-600 border-stone-300",
};

export function LensManager() {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const session = activeDid ? sessions[activeDid] : null;

  const [did, setDid] = useState("");
  const [library, setLibrary] = useState<LensWithSchemas[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (target: string, pdsUrl?: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setLibrary(await loadLensLibrary(target.trim(), pdsUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLibrary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Default to the signed-in DID and load it once.
  useEffect(() => {
    if (activeDid && !did) setDid(activeDid);
  }, [activeDid, did]);

  useEffect(() => {
    if (did && library === null && !loading && !error) {
      void load(did, session?.pdsUrl);
    }
  }, [did, library, loading, error, load, session?.pdsUrl]);

  async function copy(uri: string) {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(uri);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked; the at-uri is selectable in the DOM anyway.
    }
  }

  return (
    <div className="px-4 sm:px-8 py-6 overflow-auto h-full">
      <div className="max-w-3xl mx-auto">
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Lenses</h2>
            <WalkthroughTrigger flow="lens" />
          </div>
          <p className="text-sm text-stone-600">
            Lenses are authored and published in protolab. This page lists what
            a repo has published, so you can reference a lens by at-uri from a
            dialect or recommendation.
          </p>
        </header>

        <section
          data-walk="lens-author"
          className="mb-6 rounded border border-stone-300 bg-stone-50 p-4"
        >
          <h3 className="font-semibold mb-1">Author a lens</h3>
          <p className="text-xs text-stone-600 mb-3">
            protolab draws lens migrations as patch circuits and publishes them
            to your PDS directly — the same{" "}
            <code>dev.panproto.schema.lens</code> records listed below. You do
            not need to bring anything back here.
          </p>
          <a
            href={PROTOLAB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block px-3 py-1 rounded bg-stone-900 text-white text-sm"
          >
            Open protolab ↗
          </a>
        </section>

        <section data-walk="lens-library">
          <div className="flex items-end gap-2 mb-3">
            <label className="flex-1">
              <span className="block text-xs text-stone-600 mb-1">
                Repo (DID)
              </span>
              <input
                type="text"
                value={did}
                onChange={(e) => {
                  setDid(e.target.value);
                  setLibrary(null);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && void load(did)}
                placeholder="did:plc:…"
                spellCheck={false}
                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => void load(did)}
              className="px-3 py-1 rounded border border-stone-300 text-sm"
            >
              Load
            </button>
          </div>

          {!activeDid && !did && (
            <p className="text-xs text-stone-500">
              Sign in to see your own lenses, or paste any DID to browse theirs.
            </p>
          )}
          {loading && <p className="text-xs text-stone-500">Loading…</p>}
          {error && <p className="text-xs text-red-700 font-mono">{error}</p>}
          {library && library.length === 0 && (
            <p className="text-sm text-stone-500">
              No lenses published by this repo yet.{" "}
              <a
                href={PROTOLAB_URL}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Author one in protolab
              </a>
              .
            </p>
          )}

          {library && library.length > 0 && (
            <ul className="flex flex-col gap-2">
              {library.map(({ lens, source, target }) => (
                <li
                  key={lens.uri}
                  className="border border-stone-200 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">
                      {source?.protocol ?? "?"} → {target?.protocol ?? "?"}
                    </span>
                    {lens.roundTripClass && (
                      <span
                        className={`text-[10px] px-2 py-[1px] rounded-full border ${
                          OPTIC_CLASS[lens.roundTripClass] ?? OPTIC_CLASS.opaque
                        }`}
                      >
                        {lens.roundTripClass}
                      </span>
                    )}
                    {lens.lawsVerified && (
                      <span className="text-[10px] text-emerald-700">
                        laws verified
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-stone-400 font-mono">
                      {lens.createdAt ? lens.createdAt.slice(0, 10) : "undated"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 text-[10px] text-stone-500 break-all">
                      {lens.uri}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(lens.uri)}
                      className="text-[11px] px-2 py-[2px] rounded border border-stone-300 shrink-0"
                    >
                      {copied === lens.uri ? "copied" : "copy at-uri"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
