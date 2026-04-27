import { useEffect, useRef, useState } from "react";
import { useSessionsStore } from "../sessions/store";
import { resumeSession, signOut, startSignIn } from "../sessions/oauth";
import type { AuthIntent } from "../sessions/scopes";

type Status = "loading" | "ready";

interface ActorMatch {
  did: string;
  handle: string;
  displayName?: string;
}

// bsky's public AppView fronts searchActorsTypeahead with open CORS,
// so we can hit it from the browser without a proxy. Returns the
// shape `{ actors: [{ did, handle, displayName, ... }] }`.
const TYPEAHEAD_URL =
  "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead";

const INTENT_LABEL: Record<AuthIntent, string> = {
  "read-only": "Read-only",
  curator: "Curator",
  full: "Full",
};

const INTENT_HINT: Record<AuthIntent, string> = {
  "read-only": "no publish capability",
  curator: "publish dialect, vocab, community, recommendation",
  full: "curator scopes plus belief, encounter, correction, observation, verification, bounty",
};

export function SessionMenu() {
  const [status, setStatus] = useState<Status>("loading");
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [intent, setIntent] = useState<AuthIntent>("curator");
  const [matches, setMatches] = useState<ActorMatch[]>([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const skipNextSearchRef = useRef(false);

  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const setActiveDid = useSessionsStore((s) => s.setActiveDid);

  useEffect(() => {
    void resumeSession()
      .catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn("resumeSession failed", e);
      })
      .finally(() => setStatus("ready"));
  }, []);

  // Debounced typeahead against bsky's public actor search. The
  // ref-guarded skip lets us bypass a search when we just programmatically
  // set the handle from a clicked match (otherwise the input change
  // triggers a fresh fetch with the now-complete handle as the query).
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const q = handle.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const url = `${TYPEAHEAD_URL}?q=${encodeURIComponent(q)}&limit=8`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: { actors?: ActorMatch[] }) => {
          setMatches(data.actors ?? []);
          setMatchesOpen(true);
        })
        .catch(() => {
          /* network or CORS hiccup; just no suggestions */
        });
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [handle]);

  if (status === "loading") {
    return (
      <span className="text-xs text-stone-400">checking session…</span>
    );
  }

  const active = activeDid ? sessions[activeDid] : undefined;
  const sessionList = Object.values(sessions);

  async function doSignIn() {
    if (!handle.trim()) return;
    setSigningIn(true);
    setError(null);
    try {
      // signIn navigates the browser; the Promise typically never
      // resolves under the happy path. We surface anything that
      // throws synchronously as an error in the menu.
      await startSignIn(handle.trim(), intent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSigningIn(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={active ? `@${active.label}` : "Sign in"}
        className={
          active
            ? "rounded-full overflow-hidden w-8 h-8 ring-2 ring-emerald-300 hover:ring-emerald-400 bg-stone-200 flex items-center justify-center"
            : "px-3 py-1 text-xs rounded bg-stone-100 text-stone-700 border border-stone-300"
        }
      >
        {active
          ? active.avatar
            ? (
                <img
                  src={active.avatar}
                  alt={`@${active.label}`}
                  className="w-8 h-8 object-cover"
                />
              )
            : (
                <span className="text-xs font-mono text-stone-700">
                  {(active.handle ?? active.did).slice(0, 2).toUpperCase()}
                </span>
              )
          : "Sign in"}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 bg-white border border-stone-200 rounded shadow-lg p-4 text-sm z-20">
          <h4 className="font-semibold mb-2">Sessions</h4>
          {sessionList.length === 0 ? (
            <p className="text-xs text-stone-500 mb-3">
              No sessions yet. Sign in to a PDS to publish drafts directly.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 mb-3">
              {sessionList.map((s) => (
                <li
                  key={s.did}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    activeDid === s.did
                      ? "bg-emerald-50 border border-emerald-300"
                      : "border border-stone-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveDid(s.did)}
                    className="text-left flex-1 flex items-center gap-2"
                  >
                    {s.avatar ? (
                      <img
                        src={s.avatar}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-[9px] font-mono text-stone-600">
                        {(s.handle ?? s.did).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-stone-800 truncate">
                        {s.handle ?? s.did}
                      </div>
                      {s.displayName && (
                        <div className="text-[10px] text-stone-500 truncate">
                          {s.displayName}
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut(s.did)}
                    className="text-xs text-stone-500 px-1"
                    title="Sign out"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h4 className="font-semibold mb-2 mt-3">Add a session</h4>
          <label className="block mb-2 relative">
            <span className="text-xs text-stone-600">Handle</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setMatchesOpen(true);
              }}
              onFocus={() => {
                if (matches.length > 0) setMatchesOpen(true);
              }}
              onBlur={() => {
                // Delay so a click on a suggestion fires before the
                // popover unmounts.
                setTimeout(() => setMatchesOpen(false), 120);
              }}
              placeholder="alice.bsky.social"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
            />
            {matchesOpen && matches.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-stone-200 rounded shadow max-h-60 overflow-auto">
                {matches.map((m) => (
                  <li key={m.did}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        // Use mousedown so the click registers before
                        // the input's onBlur closes the popover.
                        e.preventDefault();
                        skipNextSearchRef.current = true;
                        setHandle(m.handle);
                        setMatches([]);
                        setMatchesOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 hover:bg-stone-100"
                    >
                      <div className="font-mono text-xs text-stone-800">
                        {m.handle}
                      </div>
                      {m.displayName && (
                        <div className="text-[10px] text-stone-500 truncate">
                          {m.displayName}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="block mb-3">
            <span className="text-xs text-stone-600">Intent</span>
            <select
              value={intent}
              onChange={(e) =>
                setIntent(e.target.value as AuthIntent)
              }
              className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
            >
              {(Object.keys(INTENT_LABEL) as AuthIntent[]).map((k) => (
                <option key={k} value={k}>
                  {INTENT_LABEL[k]}
                </option>
              ))}
            </select>
            <span className="block mt-1 text-[11px] text-stone-500">
              {INTENT_HINT[intent]}
            </span>
          </label>
          <button
            type="button"
            disabled={signingIn || !handle.trim()}
            onClick={() => void doSignIn()}
            className="px-3 py-1 rounded bg-stone-900 text-white text-xs disabled:bg-stone-400"
          >
            {signingIn ? "Redirecting…" : "Sign in"}
          </button>
          {error && (
            <p className="mt-3 text-red-700 text-xs whitespace-pre-wrap">
              {error}
            </p>
          )}

          <div className="flex justify-end mt-3">
            <button
              type="button"
              className="text-stone-500 text-xs"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
