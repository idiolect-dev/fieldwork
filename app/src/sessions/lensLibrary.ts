// Read a repo's published lenses.
//
// fieldwork does not author or publish lenses — protolab is the authoring
// surface, and as of 0.8.0 it publishes to the user's PDS itself. What
// fieldwork needs is the *read* side: a dialect or recommendation draft
// references a lens by at-uri, so the curator has to be able to see which
// lenses they have and copy one out.
//
// Listing records is an unauthenticated public read, so this works signed
// out and costs nothing in the OAuth grant. That is why fieldwork no longer
// requests `repo:dev.panproto.schema.lens`.

const LENS_NSID = "dev.panproto.schema.lens";
const SCHEMA_NSID = "dev.panproto.schema.schema";

export interface LensRecord {
  uri: string;
  cid: string;
  sourceSchema: string;
  targetSchema: string;
  objectHash: string;
  roundTripClass?: "iso" | "retraction" | "projection" | "opaque";
  lawsVerified?: boolean;
  createdAt: string;
}

export interface SchemaRecord {
  uri: string;
  protocol: string;
  objectHash: string;
}

/** A lens plus whatever we know about the schemas at each end. */
export interface LensWithSchemas {
  lens: LensRecord;
  source?: SchemaRecord;
  target?: SchemaRecord;
}

export class LensLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LensLibraryError";
  }
}

/** Resolve a DID's PDS endpoint from its DID document. */
export async function resolvePds(did: string): Promise<string> {
  const url = did.startsWith("did:web:")
    ? `https://${did.slice("did:web:".length).replace(/:/g, "/")}/.well-known/did.json`
    : `https://plc.directory/${did}`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new LensLibraryError(`Could not resolve ${did} (HTTP ${r.status})`);
  }
  const doc: { service?: Array<{ id: string; serviceEndpoint: string }> } =
    await r.json();
  const endpoint = doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
  if (!endpoint) {
    throw new LensLibraryError(`${did} has no #atproto_pds service endpoint`);
  }
  return endpoint.replace(/\/$/, "");
}

interface Listed {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

async function listAll(pds: string, did: string, collection: string): Promise<Listed[]> {
  const out: Listed[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ repo: did, collection, limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const r = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`);
    // An absent collection 400s on some PDS implementations; that is an
    // empty library, not an error.
    if (r.status === 400) return out;
    if (!r.ok) {
      throw new LensLibraryError(`listRecords ${collection} failed (HTTP ${r.status})`);
    }
    const page = (await r.json()) as { records?: Listed[]; cursor?: string };
    out.push(...(page.records ?? []));
    cursor = page.cursor;
  } while (cursor);
  return out;
}

/**
 * Every lens published by `did`, newest first, with its endpoint schemas
 * resolved so the list can show `atproto → openapi` instead of two at-uris.
 */
export async function loadLensLibrary(
  did: string,
  pdsUrl?: string,
): Promise<LensWithSchemas[]> {
  const pds = pdsUrl && pdsUrl.length > 0 ? pdsUrl : await resolvePds(did);
  const [lensRecords, schemaRecords] = await Promise.all([
    listAll(pds, did, LENS_NSID),
    listAll(pds, did, SCHEMA_NSID),
  ]);

  const schemas = new Map<string, SchemaRecord>();
  for (const r of schemaRecords) {
    const v = r.value as Partial<SchemaRecord>;
    schemas.set(r.uri, {
      uri: r.uri,
      protocol: v.protocol ?? "unknown",
      objectHash: v.objectHash ?? "",
    });
  }

  return lensRecords
    .map((r) => {
      const v = r.value as Partial<LensRecord>;
      return {
        uri: r.uri,
        cid: r.cid,
        sourceSchema: v.sourceSchema ?? "",
        targetSchema: v.targetSchema ?? "",
        objectHash: v.objectHash ?? "",
        roundTripClass: v.roundTripClass,
        lawsVerified: v.lawsVerified,
        createdAt: v.createdAt ?? "",
      } satisfies LensRecord;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((lens) => ({
      lens,
      source: schemas.get(lens.sourceSchema),
      target: schemas.get(lens.targetSchema),
    }));
}

/** Where protolab lives, for the "author a lens" handoff. */
export const PROTOLAB_URL = "https://panproto.dev/protolab/";
