// Normalize handle-bearing at-uris to DID-bearing at-uris.
//
// The autocomplete lets users type and pick handles for ergonomics
// (`at://aaron.bsky.social/dev.idiolect.community/main`), but
// handles can be reassigned to a different DID. The atproto-level
// canonical record reference uses the DID, since DIDs are stable.
// Every path that serialises a draft (publish, export) walks the
// body through this normaliser first so the bytes that actually
// land on the network or in a JSON file always carry DID at-uris.

const HANDLE_TO_DID_CACHE = new Map<string, string>();

export async function resolveHandleToDid(
  handle: string,
): Promise<string | null> {
  if (HANDLE_TO_DID_CACHE.has(handle)) {
    return HANDLE_TO_DID_CACHE.get(handle) ?? null;
  }
  try {
    const url = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data: { did?: string } = await r.json();
    if (data.did) {
      HANDLE_TO_DID_CACHE.set(handle, data.did);
      return data.did;
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolve the repo segment of an at-uri to a DID, leaving the rest unchanged. */
export async function normalizeAtUri(uri: string): Promise<string> {
  if (!uri.startsWith("at://")) return uri;
  const rest = uri.slice("at://".length);
  const slash = rest.indexOf("/");
  const repo = slash >= 0 ? rest.slice(0, slash) : rest;
  const tail = slash >= 0 ? rest.slice(slash) : "";
  if (repo.startsWith("did:")) return uri;
  const did = await resolveHandleToDid(repo);
  if (!did) return uri;
  return `at://${did}${tail}`;
}

/**
 * Walk a JSON-shaped value, normalising every at-uri string in
 * place. Object/array structure is preserved; non-at-uri strings
 * are untouched.
 */
export async function normalizeBodyAtUris<T>(body: T): Promise<T> {
  if (typeof body === "string") {
    if (body.startsWith("at://")) {
      const next = await normalizeAtUri(body);
      return next as unknown as T;
    }
    return body;
  }
  if (Array.isArray(body)) {
    const out: unknown[] = [];
    for (const item of body) out.push(await normalizeBodyAtUris(item));
    return out as unknown as T;
  }
  if (body && typeof body === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      out[k] = await normalizeBodyAtUris(v);
    }
    return out as unknown as T;
  }
  return body;
}
