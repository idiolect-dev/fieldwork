// Resolve an at-uri to its record body via an atproto AppView.
//
// `getRecord` returns `{ uri, value }`; we hand the caller `value`,
// which is the record body shaped exactly like a fieldwork draft.

import { wasm } from "../wasm/loader";

interface ParsedAtUri {
  canonical: string;
}

interface GetRecordResponse {
  uri?: string;
  cid?: string;
  value: unknown;
}

export async function resolveAtUri(
  uri: string,
  appViewBaseUrl: string,
): Promise<unknown> {
  // Validate the at-uri shape client-side first so a typo doesn't burn
  // a network round-trip and we surface a structured parse error.
  const parsed = wasm().parseAtUri(uri) as ParsedAtUri;
  // Split the canonical form: at://{did}/{collection}/{rkey}.
  const stripped = parsed.canonical.replace(/^at:\/\//, "");
  const [did, collection, rkey] = stripped.split("/");
  if (!did || !collection || !rkey) {
    throw new Error(`could not split at-uri after parse: ${parsed.canonical}`);
  }
  const url = new URL(
    "/xrpc/com.atproto.repo.getRecord",
    appViewBaseUrl,
  );
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", collection);
  url.searchParams.set("rkey", rkey);
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { error?: string; message?: string };
      detail = body.message ?? body.error ?? "";
    } catch {
      // ignore
    }
    throw new Error(
      `getRecord failed (${resp.status} ${resp.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }
  const body = (await resp.json()) as GetRecordResponse;
  return body.value;
}
