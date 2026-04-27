// Publish a panproto lens record to the user's PDS.
//
// Lens records aren't fieldwork-authored (they come from protolab
// or another panproto authoring surface), so they sit outside the
// `Draft` machinery. This helper takes a parsed lens JSON body,
// stamps the `$type`, and calls com.atproto.repo.createRecord
// against the active session.

import { activeAgent } from "./oauth";
import { useSessionsStore } from "./store";
import { hasScope, REPO_SCOPES } from "./scopes";
import { normalizeBodyAtUris } from "./atUriNormalize";
import { PublishError } from "./publish";

const LENS_NSID = "dev.panproto.schema.lens";

export interface LensPublishResult {
  uri: string;
  cid: string;
}

export async function publishLens(
  body: Record<string, unknown>,
  rkey?: string,
): Promise<LensPublishResult> {
  const agent = await activeAgent();
  if (!agent) {
    throw new PublishError(
      "No active session. Sign in to a PDS before publishing a lens.",
    );
  }
  const sessionDid = useSessionsStore.getState().activeDid;
  if (!sessionDid) throw new PublishError("Session lost between checks.");

  const session = useSessionsStore.getState().sessions[sessionDid];
  const granted = session?.scope?.split(/\s+/) ?? [];
  if (granted.length > 0 && !hasScope(granted, REPO_SCOPES.LENS)) {
    throw new PublishError(
      `Active session is missing ${REPO_SCOPES.LENS}. Re-sign in with a curator-or-higher scope to publish lenses.`,
    );
  }

  const record = await normalizeBodyAtUris({ ...body, $type: LENS_NSID });

  try {
    const out = await agent.com.atproto.repo.createRecord({
      repo: sessionDid,
      collection: LENS_NSID,
      rkey,
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
