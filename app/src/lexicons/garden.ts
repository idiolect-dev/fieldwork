// Client for lexicon.garden's NSID autocomplete + lexicon-resolve
// endpoints. Mirrors protolab's `presentation/lexiconGarden.ts`.
//
// CORS caveat: `/api/autocomplete-nsid` does NOT set
// `Access-Control-Allow-Origin`, so direct cross-origin reads are
// blocked. In dev we proxy through Vite (see `vite.config.ts`'s
// `/lexicon-garden` rule). In production the SPA tries the same
// proxy path and falls back to disabling autocomplete when it
// fails — `/xrpc/com.atproto.lexicon.resolveLexicon` (used by
// `resolveLexicon` below) DOES have open CORS and works directly
// regardless of the proxy.

const AUTOCOMPLETE_PATH = "/api/autocomplete-nsid";
const RESOLVE_PATH = "/xrpc/com.atproto.lexicon.resolveLexicon";

/** Resolve a base URL for lexicon.garden requests. */
function autocompleteBaseUrl(): string {
  if (typeof window === "undefined") return "https://lexicon.garden";
  // Dev mode: route through Vite's proxy. Production mode: try the
  // same path (works behind a Pages-edge proxy) or direct host
  // (will fail under default CORS — autocomplete falls back to
  // no-suggestions, resolution still works).
  return import.meta.env.DEV ? "/lexicon-garden" : "https://lexicon.garden";
}

/** A single NSID suggestion from the autocomplete endpoint. */
export interface LexiconSuggestion {
  /** Fully-qualified NSID, e.g. `app.bsky.feed.post`. */
  nsid: string;
  /** DID of the authority publishing the lexicon, when known. */
  did?: string;
}

interface AutocompleteResponse {
  suggestions?: Array<{
    type?: string;
    label?: string;
    did?: string;
    url?: string;
  }>;
}

interface ResolveLexiconResponse {
  cid?: string;
  uri?: string;
  schema?: unknown;
}

/**
 * Query lexicon.garden's autocomplete endpoint for NSID suggestions
 * matching `query`. Returns at most `limit` suggestions. Throws on
 * network / CORS failure so callers can decide to hide the
 * dropdown.
 */
export async function fetchLexiconAutocomplete(
  query: string,
  signal?: AbortSignal,
  limit = 25,
): Promise<LexiconSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${autocompleteBaseUrl()}${AUTOCOMPLETE_PATH}?q=${encodeURIComponent(
    trimmed,
  )}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`autocomplete HTTP ${res.status}`);
  }
  const body = (await res.json()) as AutocompleteResponse;
  const raw = body.suggestions ?? [];
  return raw
    .filter((s) => s.type === "nsid" && typeof s.label === "string")
    .slice(0, limit)
    .map((s) => ({ nsid: s.label as string, did: s.did }));
}

/**
 * Resolve a single lexicon by NSID. Returns the lexicon document
 * the auth server holds for that NSID — same shape as the JSON
 * files under `dev/<authority>/<...>.json`.
 *
 * Uses `/xrpc/com.atproto.lexicon.resolveLexicon`, which has open
 * CORS and works without a proxy in any deployment.
 */
export async function resolveLexicon(
  nsid: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const trimmed = nsid.trim();
  if (!trimmed) {
    throw new Error("nsid is empty");
  }
  // Production resolution must hit the public origin directly
  // because the Vite proxy only exists in dev. The xrpc endpoint
  // has open CORS so this is fine cross-origin.
  const base = "https://lexicon.garden";
  const url = `${base}${RESOLVE_PATH}?nsid=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.message ?? body.error ?? "";
    } catch {
      // ignore
    }
    throw new Error(
      `resolveLexicon ${nsid} HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  const body = (await res.json()) as ResolveLexiconResponse;
  // Hand back the inner schema if the server wrapped it; otherwise
  // hand back the raw response. Either matches what
  // `validateLexiconDocument` expects.
  if (
    body.schema &&
    typeof body.schema === "object" &&
    body.schema !== null &&
    "lexicon" in (body.schema as Record<string, unknown>)
  ) {
    return body.schema;
  }
  return body;
}
