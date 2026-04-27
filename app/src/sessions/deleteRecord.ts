// Delete a record from the active session's PDS.
//
// Mirror of `publishDraft` / `publishLens` for the destructive
// direction. Takes an at-uri, splits it, scope-guards against the
// granted `repo:<collection>` scope, and calls
// `com.atproto.repo.deleteRecord`.

import { activeAgent } from "./oauth";
import { useSessionsStore } from "./store";
import { hasScope } from "./scopes";
import { PublishError } from "./publish";

export interface ParsedAtUri {
  did: string;
  collection: string;
  rkey: string;
}

export function parseAtUri(uri: string): ParsedAtUri | null {
  if (!uri.startsWith("at://")) return null;
  const parts = uri.slice("at://".length).split("/");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return { did: parts[0], collection: parts[1], rkey: parts[2] };
}

export async function deleteRecord(uri: string): Promise<void> {
  const parsed = parseAtUri(uri);
  if (!parsed) {
    throw new PublishError(
      `Could not parse at-uri "${uri}"; expected at://<repo>/<collection>/<rkey>.`,
    );
  }

  const agent = await activeAgent();
  if (!agent) {
    throw new PublishError(
      "No active session. Sign in to a PDS before deleting a record.",
    );
  }
  const sessionDid = useSessionsStore.getState().activeDid;
  if (!sessionDid) {
    throw new PublishError("Session lost between checks.");
  }

  // Repo segment must match the active session's DID. We don't try
  // to resolve handles here because the publish path always rewrites
  // to the canonical DID before sending; if the user is asking us to
  // delete a record under someone else's repo, refuse and surface a
  // clear error.
  if (parsed.did !== sessionDid) {
    throw new PublishError(
      `Cannot delete: the at-uri's repo (${parsed.did}) does not match the active session (${sessionDid}).`,
    );
  }

  // Scope guard: deleteRecord requires the same `repo:<collection>`
  // scope as createRecord under that NSID. An unset scope (the
  // session-info call hasn't surfaced one yet) falls through to the
  // PDS for the final say.
  const session = useSessionsStore.getState().sessions[sessionDid];
  const granted = session?.scope?.split(/\s+/) ?? [];
  const required = `repo:${parsed.collection}`;
  if (granted.length > 0 && !hasScope(granted, required)) {
    throw new PublishError(
      `Active session is missing ${required}. Re-sign in with a tier that grants it.`,
    );
  }

  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: parsed.did,
      collection: parsed.collection,
      rkey: parsed.rkey,
    });
  } catch (e) {
    throw new PublishError(
      `deleteRecord failed: ${e instanceof Error ? e.message : String(e)}`,
      e,
    );
  }
}
