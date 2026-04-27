// Segment-aware autocomplete for atproto at-uri inputs.
//
// Parses the partial `at://<repo>/<collection>/<rkey>` the user has
// typed so far and pulls suggestions appropriate to the current
// segment. The repo segment accepts either a DID or a handle; both
// are first-class atproto identifiers, and the user typically
// remembers handles. Suggestions are dual-sourced:
//
// - Repo segment:
//   * Local: the active session, every other signed-in session,
//     plus repos parsed from at-uri history. Each carries the
//     handle alongside the DID when known so the dropdown shows
//     human-readable labels.
//   * Live: bsky's `app.bsky.actor.searchActorsTypeahead` (open
//     CORS) for handle prefix matches across the wider network.
// - Collection segment: every NSID bundled with @idiolect-dev/schema
//   whose main def is a `record`, prefix-filtered.
// - Rkey segment: live `com.atproto.repo.listRecords` against the
//   PDS that hosts the typed repo. The repo segment is passed as-is
//   (atproto's listRecords accepts both DIDs and handles); we only
//   need to resolve the PDS endpoint.
//
// PDS resolution: handles are routed through bsky's public AppView's
// `resolveHandle` to a DID first; did:plc:* go via plc.directory;
// did:web:* via the host's `.well-known/did.json`. All cached per
// page session.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { bundledLexicons } from "../lexicons/bundle";
import { useSessionsStore } from "../sessions/store";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Lock the collection segment to one specific NSID. The
   * Recommendation Builder uses this for "issuing community
   * at-uri" so the user only needs to pick a repo and rkey.
   */
  expectedCollection?: string;
}

interface Parsed {
  raw: string;
  repo?: string;
  collection?: string;
  rkey?: string;
  // "handle-search" mode covers bare-text input (no at:// prefix);
  // we treat the whole string as a handle / DID query and fan out
  // to bsky's typeahead. Once the input gains an at:// prefix we
  // switch to segmented parsing.
  focus: "handle-search" | "repo" | "collection" | "rkey";
}

interface RepoSuggestion {
  /** What ends up in the at-uri (DID or handle). */
  identifier: string;
  /** Optional human label rendered next to the identifier. */
  label?: string;
  /** Optional avatar URL surfaced from typeahead. */
  avatar?: string;
  /** Marks the active-session entry visually. */
  active?: boolean;
}

interface Suggestion {
  /** The full or partial at-uri the click installs into the input. */
  uri: string;
  /** Primary label rendered on the row. */
  label: string;
  /** Optional secondary label (handle vs did, NSID kind, etc.). */
  detail?: string;
  /** Optional avatar URL (repo segment only). */
  avatar?: string;
}

function parse(input: string): Parsed {
  if (!input.startsWith("at://")) {
    return {
      raw: input,
      repo: input.length > 0 ? input : undefined,
      focus: "handle-search",
    };
  }
  const rest = input.slice("at://".length);
  const parts = rest.split("/");
  const trailing = input.endsWith("/");
  if (parts.length === 1 && !trailing) {
    return { raw: input, repo: parts[0] || undefined, focus: "repo" };
  }
  if (parts.length <= 2) {
    return {
      raw: input,
      repo: parts[0],
      collection: trailing && parts.length === 1 ? "" : parts[1] ?? "",
      focus: "collection",
    };
  }
  return {
    raw: input,
    repo: parts[0],
    collection: parts[1],
    rkey: parts.slice(2).join("/"),
    focus: "rkey",
  };
}

function looksLikeDid(s: string): boolean {
  return s.startsWith("did:");
}

// Resolution caches. Failed lookups are negative-cached so example
// DIDs (`did:plc:example`, fixture stand-ins) don't spam plc.directory
// once per autocomplete render. `null` = "we tried and failed", so we
// stop short of the network on subsequent calls.
const PDS_CACHE = new Map<string, string | null>();
const HANDLE_TO_DID_CACHE = new Map<string, string | null>();

async function resolveHandleToDid(handle: string): Promise<string | null> {
  if (HANDLE_TO_DID_CACHE.has(handle)) {
    return HANDLE_TO_DID_CACHE.get(handle) ?? null;
  }
  try {
    const url = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    const r = await fetch(url);
    if (!r.ok) {
      HANDLE_TO_DID_CACHE.set(handle, null);
      return null;
    }
    const data: { did?: string } = await r.json();
    HANDLE_TO_DID_CACHE.set(handle, data.did ?? null);
    return data.did ?? null;
  } catch {
    HANDLE_TO_DID_CACHE.set(handle, null);
    return null;
  }
}

async function resolvePds(repo: string): Promise<string | null> {
  if (PDS_CACHE.has(repo)) return PDS_CACHE.get(repo) ?? null;
  let did = repo;
  if (!looksLikeDid(repo)) {
    const resolved = await resolveHandleToDid(repo);
    if (!resolved) {
      PDS_CACHE.set(repo, null);
      return null;
    }
    did = resolved;
  }
  if (did.startsWith("did:plc:")) {
    try {
      const r = await fetch(`https://plc.directory/${did}`);
      if (!r.ok) {
        PDS_CACHE.set(repo, null);
        return null;
      }
      const doc: {
        service?: Array<{ id: string; serviceEndpoint: string }>;
      } = await r.json();
      const svc = doc.service?.find((s) => s.id === "#atproto_pds");
      const url = svc?.serviceEndpoint?.replace(/\/$/, "") ?? null;
      PDS_CACHE.set(repo, url);
      return url;
    } catch {
      PDS_CACHE.set(repo, null);
      return null;
    }
  }
  if (did.startsWith("did:web:")) {
    const host = did.slice("did:web:".length);
    try {
      const r = await fetch(`https://${host}/.well-known/did.json`);
      if (!r.ok) {
        PDS_CACHE.set(repo, null);
        return null;
      }
      const doc: {
        service?: Array<{ id: string; serviceEndpoint: string }>;
      } = await r.json();
      const svc = doc.service?.find((s) => s.id === "#atproto_pds");
      const url = svc?.serviceEndpoint?.replace(/\/$/, "") ?? null;
      PDS_CACHE.set(repo, url);
      return url;
    } catch {
      PDS_CACHE.set(repo, null);
      return null;
    }
  }
  PDS_CACHE.set(repo, null);
  return null;
}

interface ListRecordsResponse {
  records?: Array<{ uri: string; cid: string }>;
}

async function listRecordRkeys(
  pds: string,
  repo: string,
  collection: string,
  signal: AbortSignal,
): Promise<string[]> {
  const url = `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(
    repo,
  )}&collection=${encodeURIComponent(collection)}&limit=50`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const data: ListRecordsResponse = await r.json();
  return (data.records ?? [])
    .map((rec) => rec.uri.split("/").pop() ?? "")
    .filter(Boolean);
}

interface TypeaheadActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

async function searchActorsTypeahead(
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

const HISTORY_KEY = "fieldwork:aturi-history";

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function isCompleteAtUri(uri: string): boolean {
  if (!uri.startsWith("at://")) return false;
  const parts = uri.slice("at://".length).split("/");
  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

function pushHistory(uri: string): void {
  if (!isCompleteAtUri(uri)) return;
  const prev = readHistory().filter((u) => u !== uri);
  const next = [uri, ...prev].slice(0, 50);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota or privacy mode */
  }
}

const RECORD_NSIDS: string[] = bundledLexicons
  .filter((l) => {
    const main = (l.body as { defs?: Record<string, { type?: string }> }).defs
      ?.main;
    return main?.type === "record";
  })
  .map((l) => l.nsid);

export function AtUriAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  expectedCollection,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parse(value), [value]);

  const localRepoSuggestions = useMemo<RepoSuggestion[]>(() => {
    const seen = new Set<string>();
    const out: RepoSuggestion[] = [];
    function push(s: RepoSuggestion) {
      if (seen.has(s.identifier)) return;
      seen.add(s.identifier);
      out.push(s);
    }
    if (activeDid && sessions[activeDid]) {
      const sess = sessions[activeDid];
      const id = sess.handle ?? sess.did;
      push({
        identifier: id,
        label: sess.handle ? sess.did : undefined,
        avatar: sess.avatar,
        active: true,
      });
    }
    for (const s of Object.values(sessions)) {
      const id = s.handle ?? s.did;
      push({ identifier: id, label: s.handle ? s.did : undefined, avatar: s.avatar });
    }
    for (const u of readHistory()) {
      const p = parse(u);
      if (p.repo) push({ identifier: p.repo });
    }
    return out;
  }, [sessions, activeDid]);

  useEffect(() => {
    const ctrl = new AbortController();

    async function refresh() {
      // ---- Handle-search mode (no at:// prefix) ----
      // The user is typing a bare name; treat the entire input as a
      // handle / DID query. Local sessions and bsky's typeahead both
      // contribute. Picking installs the at-uri form.
      if (parsed.focus === "handle-search") {
        const stub = (parsed.repo ?? "").toLowerCase();
        const localMatches = localRepoSuggestions
          .filter(
            (r) =>
              stub === "" ||
              r.identifier.toLowerCase().includes(stub) ||
              (r.label ?? "").toLowerCase().includes(stub),
          )
          .map<Suggestion>((r) => ({
            uri: `at://${r.identifier}/`,
            label: r.identifier,
            detail: r.active ? `${r.label ?? ""} · active`.trim() : r.label,
            avatar: r.avatar,
          }));

        // When the call site has an expectedCollection (e.g. "owning
        // community at-uri" -> dev.idiolect.community), pre-list the
        // active session's records of that kind so the user can pick
        // a fully-qualified at-uri without ever typing the collection
        // segment. Records appear at the top of the dropdown.
        let recordSuggestions: Suggestion[] = [];
        if (expectedCollection && activeDid) {
          const sess = sessions[activeDid];
          const repoId = sess?.handle ?? sess?.did;
          if (repoId) {
            const pds = await resolvePds(repoId);
            if (pds && !ctrl.signal.aborted) {
              const rkeys = await listRecordRkeys(
                pds,
                repoId,
                expectedCollection,
                ctrl.signal,
              );
              recordSuggestions = rkeys.slice(0, 8).map((r) => ({
                uri: `at://${repoId}/${expectedCollection}/${r}`,
                label: `${repoId}/${expectedCollection}/${r}`,
                detail: `your ${expectedCollection} · rkey ${r}`,
                avatar: sess?.avatar,
              }));
            }
          }
        }

        let liveSuggestions: Suggestion[] = [];
        if (stub.length >= 2 && !looksLikeDid(stub)) {
          const actors = await searchActorsTypeahead(stub, ctrl.signal);
          if (ctrl.signal.aborted) return;
          liveSuggestions = actors.map((a) => ({
            uri: `at://${a.handle}/`,
            label: a.handle,
            detail: a.displayName ? `${a.displayName} · ${a.did}` : a.did,
            avatar: a.avatar,
          }));
        }

        const seenUri = new Set<string>();
        const merged: Suggestion[] = [];
        for (const s of [...recordSuggestions, ...localMatches, ...liveSuggestions]) {
          if (seenUri.has(s.uri)) continue;
          seenUri.add(s.uri);
          merged.push(s);
        }
        setSuggestions(merged);
        return;
      }

      // ---- Repo segment under at:// ----
      // The user has explicitly opted into raw at-uri mode. Surface
      // history first (unique fully-qualified at-uris) and then local
      // sessions for the typed prefix.
      if (parsed.focus === "repo") {
        const stub = (parsed.repo ?? "").toLowerCase();
        const localMatches = localRepoSuggestions
          .filter(
            (r) =>
              stub === "" ||
              r.identifier.toLowerCase().includes(stub) ||
              (r.label ?? "").toLowerCase().includes(stub),
          )
          .map<Suggestion>((r) => ({
            uri: `at://${r.identifier}/`,
            label: r.identifier,
            detail: r.active ? `${r.label ?? ""} · active`.trim() : r.label,
            avatar: r.avatar,
          }));

        const historySuggestions: Suggestion[] = readHistory()
          .filter((u) => u.toLowerCase().includes(stub))
          .slice(0, 6)
          .map((u) => ({
            uri: u,
            label: u,
            detail: "from history",
          }));

        const seenUri = new Set<string>();
        const merged: Suggestion[] = [];
        for (const s of [...historySuggestions, ...localMatches]) {
          if (seenUri.has(s.uri)) continue;
          seenUri.add(s.uri);
          merged.push(s);
        }
        setSuggestions(merged);
        return;
      }

      // ---- Collection segment ----
      if (parsed.focus === "collection") {
        if (expectedCollection) {
          // If the user has already typed enough of the expected
          // collection, hop straight to rkey suggestions.
          if (parsed.collection === expectedCollection && parsed.repo) {
            const pds = await resolvePds(parsed.repo);
            if (!pds || ctrl.signal.aborted) return;
            const rkeys = await listRecordRkeys(
              pds,
              parsed.repo,
              expectedCollection,
              ctrl.signal,
            );
            setSuggestions(
              rkeys.slice(0, 12).map((r) => ({
                uri: `at://${parsed.repo}/${expectedCollection}/${r}`,
                label: r,
                detail: expectedCollection,
              })),
            );
            return;
          }
          setSuggestions([
            {
              uri: `at://${parsed.repo}/${expectedCollection}/`,
              label: expectedCollection,
            },
          ]);
          return;
        }
        const stub = (parsed.collection ?? "").toLowerCase();
        const matches = RECORD_NSIDS.filter((n) =>
          n.toLowerCase().includes(stub),
        ).slice(0, 12);
        setSuggestions(
          matches.map((n) => ({
            uri: `at://${parsed.repo}/${n}/`,
            label: n,
          })),
        );
        return;
      }

      // ---- Rkey segment ----
      if (parsed.focus === "rkey" && parsed.repo && parsed.collection) {
        const pds = await resolvePds(parsed.repo);
        if (!pds || ctrl.signal.aborted) return;
        const rkeys = await listRecordRkeys(
          pds,
          parsed.repo,
          parsed.collection,
          ctrl.signal,
        );
        const stub = (parsed.rkey ?? "").toLowerCase();
        const matches = rkeys
          .filter((r) => r.toLowerCase().startsWith(stub))
          .slice(0, 12);
        setSuggestions(
          matches.map((r) => ({
            uri: `at://${parsed.repo}/${parsed.collection}/${r}`,
            label: r,
            detail: parsed.collection,
          })),
        );
      }
    }

    void refresh();
    return () => ctrl.abort();
  }, [parsed, localRepoSuggestions, expectedCollection, activeDid, sessions]);

  // Display rule: storage stays canonical `at://X/Y/Z`, but the
  // input shows the `X/Y/Z` shorthand. The leading `at://` is a
  // syntactic carrier the user shouldn't need to see; handles read
  // as bare paths. When the user types `at://...` themselves we
  // accept it and re-strip on the way back into state.
  const displayValue = value.startsWith("at://") ? value.slice(5) : value;
  const displayPlaceholder =
    placeholder && placeholder.startsWith("at://")
      ? placeholder.slice(5)
      : placeholder;

  function strip(s: string): string {
    return s.startsWith("at://") ? s.slice(5) : s;
  }

  function pick(s: Suggestion) {
    onChange(s.uri);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const next = strip(s.uri);
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
    if (s.uri.endsWith("/")) {
      setOpen(true);
    } else {
      setOpen(false);
      pushHistory(s.uri);
    }
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const typed = e.target.value;
    // If the user pastes / types a full at-uri we still want a
    // canonical at://-prefixed value in storage.
    const next = typed.length > 0 && !typed.startsWith("at://") ? `at://${typed}` : typed;
    onChange(next);
    setOpen(true);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Defer so a click on a suggestion fires before we close.
          setTimeout(() => {
            setOpen(false);
            if (value.startsWith("at://") && !value.endsWith("/")) {
              pushHistory(value);
            }
          }, 120);
        }}
        placeholder={displayPlaceholder}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={
          className ??
          "w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm"
        }
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded shadow max-h-72 overflow-auto text-xs">
          {suggestions.map((s) => (
            <li key={s.uri}>
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
                  <div className="font-mono truncate">{strip(s.label)}</div>
                  {s.detail && (
                    <div className="text-[10px] text-stone-500 truncate">
                      {s.detail}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
          <li className="px-2 py-1 text-[10px] text-stone-400 border-t border-stone-100 bg-stone-50">
            {parsed.focus === "handle-search" && "handle search"}
            {parsed.focus === "repo" && "repo segment (handle or did)"}
            {parsed.focus === "collection" && "collection segment"}
            {parsed.focus === "rkey" && "rkey (live from PDS)"}
          </li>
        </ul>
      )}
    </div>
  );
}
