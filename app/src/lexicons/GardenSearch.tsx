import { useEffect, useRef, useState } from "react";
import {
  fetchLexiconAutocomplete,
  resolveLexicon,
  type LexiconSuggestion,
} from "./garden";

interface Props {
  /** Called when the user picks a suggestion or pastes an exact NSID. */
  onResolve: (nsid: string, body: unknown) => void;
}

/**
 * Search-and-resolve box for lexicon.garden.
 *
 * Debounced autocomplete on every keystroke (150 ms). Picking a
 * suggestion (or hitting Enter on an exact NSID) issues a
 * `com.atproto.lexicon.resolveLexicon` xrpc, which has open CORS
 * and works directly without the proxy.
 *
 * Falls back gracefully when autocomplete is unreachable
 * (production builds without the dev-server proxy): the dropdown
 * disappears, the textbox keeps working as a manual NSID entry.
 */
export function GardenSearch({ onResolve }: Props) {
  const [nsid, setNsid] = useState("");
  const [suggestions, setSuggestions] = useState<LexiconSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [autocompleteAvailable, setAutocompleteAvailable] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete on every keystroke. Each effect-run
  // owns its own AbortController so a stale response can't replace
  // a fresher one when the user keeps typing.
  useEffect(() => {
    if (!nsid.trim()) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const results = await fetchLexiconAutocomplete(nsid, controller.signal);
        setSuggestions(results);
        setAutocompleteAvailable(true);
        setHighlightedIdx(-1);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        // CORS / network failure: hide the dropdown silently.
        setSuggestions([]);
        setAutocompleteAvailable(false);
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [nsid]);

  // Click-outside dismissal for the suggestion dropdown.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function pick(value: string) {
    setNsid(value);
    setShowSuggestions(false);
    setResolving(true);
    setError(null);
    try {
      const body = await resolveLexicon(value);
      onResolve(value, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter" && nsid.trim()) {
        e.preventDefault();
        void pick(nsid.trim());
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice =
        highlightedIdx >= 0 ? suggestions[highlightedIdx]?.nsid : nsid.trim();
      if (choice) void pick(choice);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        Search lexicon.garden
      </label>
      <input
        type="text"
        value={nsid}
        placeholder="app.bsky.feed.post / pub.layers.eprint / …"
        onChange={(e) => {
          setNsid(e.target.value);
          setShowSuggestions(true);
          setError(null);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
        disabled={resolving}
      />
      {!autocompleteAvailable && (
        <p className="text-[10px] text-stone-500 mt-0.5">
          autocomplete unreachable — paste a full NSID and press Enter
          to resolve directly
        </p>
      )}
      {resolving && (
        <p className="text-[10px] text-stone-500 mt-0.5">resolving…</p>
      )}
      {error && (
        <p className="text-[10px] text-red-700 mt-0.5 break-all">{error}</p>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-stone-300 rounded shadow-md max-h-56 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.nsid}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s.nsid);
              }}
              onMouseEnter={() => setHighlightedIdx(i)}
              className={`px-2 py-1 text-xs font-mono cursor-pointer ${
                i === highlightedIdx
                  ? "bg-stone-900 text-white"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <div>{s.nsid}</div>
              {s.did && (
                <div
                  className={`text-[10px] ${
                    i === highlightedIdx
                      ? "text-stone-300"
                      : "text-stone-500"
                  }`}
                >
                  {s.did}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
