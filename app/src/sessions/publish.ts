// Publish a Draft to a PDS via the active OAuth session.
//
// This is the third export shape, alongside Download JSON and Copy
// CLI command. It calls `com.atproto.repo.createRecord` directly
// against the user's PDS using an authenticated `@atproto/api`
// Agent; the OAuth client owns DPoP signing and refresh-token
// rotation.

import type { Draft } from "../workspace/types";
import { activeAgent } from "./oauth";
import { useSessionsStore } from "./store";
import { hasScope, repoScopeForKind } from "./scopes";
import { normalizeBodyAtUris } from "./atUriNormalize";
import { validateRecord } from "../panproto/validate";

export interface PublishResult {
  /** at-uri of the freshly created record. */
  uri: string;
  /** Content hash atproto assigned to the record body. */
  cid: string;
}

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/**
 * Publish a draft to the active session's PDS.
 *
 * Validates ahead of the network call:
 * - that an active session exists
 * - that the active session's scopes cover the draft's collection
 *
 * Returns the at-uri + cid the PDS minted; the caller can show it
 * in the export dialog and offer a "share link" copy.
 */
export async function publishDraft(draft: Draft): Promise<PublishResult> {
  const agent = await activeAgent();
  if (!agent) {
    throw new PublishError(
      "No active session. Sign in to a PDS before publishing.",
    );
  }
  const sessionDid = useSessionsStore.getState().activeDid;
  if (!sessionDid) throw new PublishError("Session lost between checks.");

  // Scope guard: don't bother round-tripping when we know the auth
  // server didn't grant us the needed `repo:` scope.
  const required = repoScopeForKind(draft.kind);
  const sessionScopes = sessionScopeArray();
  if (required && sessionScopes.length > 0 && !hasScope(sessionScopes, required)) {
    throw new PublishError(
      `Active session is missing the required scope ${required}. Re-sign in with a tier that grants it.`,
    );
  }

  // Schema guard: refuse to publish a draft panproto's atproto-
  // lexicon parser would reject. Catches things the form lets you
  // get away with locally (empty `lensPath`, missing required
  // fields) before they bounce off the PDS with an opaque error.
  const validation = validateRecord(draft.kind, draft.body.body);
  if (!validation.ok) {
    throw new PublishError(
      `Draft is invalid against dev.idiolect.${draft.kind}. ${validation.error ?? ""}`.trim(),
    );
  }

  const collection = `dev.idiolect.${draft.kind}`;
  // Resolve any handle-bearing at-uris in the body to their DID
  // canonical form before sending. Handles can be reassigned; DIDs
  // are stable, so the persisted record on the network refers to
  // the publisher's intent rather than whatever the handle happens
  // to mean later.
  const record = await normalizeBodyAtUris(unwrapDraftBody(draft));

  try {
    const out = await agent.com.atproto.repo.createRecord({
      repo: sessionDid,
      collection,
      record,
    });
    return { uri: out.data.uri, cid: out.data.cid };
  } catch (e) {
    throw new PublishError(
      `createRecord failed: ${e instanceof Error ? e.message : String(e)}`,
      e,
    );
  }
}

function unwrapDraftBody(draft: Draft): Record<string, unknown> {
  // Workspace stores `{ kind, body: { id, label, body: <record> } }`
  //; the inner `body` is the actual record JSON the PDS expects.
  return draft.body.body;
}

/**
 * Whatever scope strings the active session was signed in with,
 * read from the cached token info synced into the sessions store
 * on the last `restore` / `signIn`. Empty array → "we don't know
 * yet"; the caller treats that as a pass and lets the PDS make the
 * final call.
 */
function sessionScopeArray(): string[] {
  const did = useSessionsStore.getState().activeDid;
  if (!did) return [];
  const session = useSessionsStore.getState().sessions[did];
  if (!session?.scope) return [];
  return session.scope.split(/\s+/).filter((s) => s.length > 0);
}
