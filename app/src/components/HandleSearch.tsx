// Small typeahead for picking a single atproto identity (DID or
// handle) without the at-uri scaffolding. Suitable for fields like
// Community.members where the lexicon expects a bare DID.
//
// Suggestions:
// - Active session and other signed-in sessions (with handles when
//   known).
// - Live bsky `searchActorsTypeahead` for the typed prefix.
//
// Picking always installs the canonical DID into state so handle
// reassignment doesn't change the meaning of a published members
// list. The displayed value falls back to the typed text so the
// field doesn't visually flip from "alice.bsky.social" to a long
// did:plc string after picking.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useSessionsStore } from "../sessions/store";
import { resolveHandleToDid } from "../sessions/atUriNormalize";

interface Props {
  value: string;
  onChange: (did: string) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  did: string;
  handle?: string;
  display?: string;
  avatar?: string;
  active?: boolean;
}

interface TypeaheadActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

async function searchActors(
  query: string,
  signal: AbortSignal,
): Promise<TypeaheadActor[]> {
  if (query.length < 2) return [];
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=8`;
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const data: { actors?: TypeaheadActor[] } = await r.json();
    return data.actors ?? [];
  } catch {
    return [];
  }
}

export function HandleSearch({ value, onChange, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);

  // Keep the input in sync if the parent value changes externally.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const localSuggestions = useMemo<Suggestion[]>(() => {
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    function push(s: Suggestion) {
      if (seen.has(s.did)) return;
      seen.add(s.did);
      out.push(s);
    }
    if (activeDid && sessions[activeDid]) {
      const sess = sessions[activeDid];
      push({
        did: sess.did,
        handle: sess.handle,
        avatar: sess.avatar,
        active: true,
      });
    }
    for (const s of Object.values(sessions)) {
      push({ did: s.did, handle: s.handle, avatar: s.avatar });
    }
    return out;
  }, [sessions, activeDid]);

  useEffect(() => {
    const ctrl = new AbortController();
    const stub = query.trim().toLowerCase();
    if (stub.startsWith("did:")) {
      setSuggestions([]);
      return () => ctrl.abort();
    }
    async function refresh() {
      const localMatches = localSuggestions.filter(
        (s) =>
          stub === "" ||
          (s.handle ?? "").toLowerCase().includes(stub) ||
          s.did.toLowerCase().includes(stub),
      );
      let live: Suggestion[] = [];
      if (stub.length >= 2) {
        const actors = await searchActors(stub, ctrl.signal);
        if (ctrl.signal.aborted) return;
        live = actors.map((a) => ({
          did: a.did,
          handle: a.handle,
          display: a.displayName,
          avatar: a.avatar,
        }));
      }
      const seen = new Set<string>();
      const merged: Suggestion[] = [];
      for (const s of [...localMatches, ...live]) {
        if (seen.has(s.did)) continue;
        seen.add(s.did);
        merged.push(s);
      }
      setSuggestions(merged);
    }
    void refresh();
    return () => ctrl.abort();
  }, [query, localSuggestions]);

  function pick(s: Suggestion) {
    setQuery(s.handle ?? s.did);
    onChange(s.did);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.blur());
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    // If the user typed a raw did, propagate it directly.
    if (v.startsWith("did:")) onChange(v);
  }

  async function onBlur() {
    // Defer so a click on a suggestion fires before this commits.
    setTimeout(async () => {
      setOpen(false);
      const trimmed = query.trim();
      if (!trimmed) {
        onChange("");
        return;
      }
      if (trimmed.startsWith("did:")) {
        onChange(trimmed);
        return;
      }
      // Try to resolve a typed handle to a DID so the stored value
      // is canonical. Fall back to the typed string if resolution
      // fails (the user can fix it later).
      const did = await resolveHandleToDid(trimmed);
      onChange(did ?? trimmed);
    }, 120);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={
          className ??
          "w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
        }
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded shadow max-h-60 overflow-auto text-xs">
          {suggestions.map((s) => (
            <li key={s.did}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className="w-full text-left px-2 py-1 hover:bg-stone-100 flex items-center gap-2"
              >
                {s.avatar ? (
                  <img
                    src={s.avatar}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-mono truncate">
                    {s.handle ?? s.did}
                    {s.active && (
                      <span className="ml-1 text-[10px] text-emerald-700">
                        active
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {s.display ?? s.did}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
