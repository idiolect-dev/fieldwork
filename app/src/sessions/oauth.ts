// atproto OAuth client for fieldwork.
//
// Wraps `@atproto/oauth-client-browser` so the rest of the app
// doesn't import directly from there. The library handles PAR,
// PKCE, DPoP, IndexedDB session storage, and refresh-token
// rotation; we only own scope selection, the post-callback
// session-store sync, and the `Agent` that does record creates.
//
// References:
// - https://atproto.com/specs/oauth
// - chive's `web/lib/auth/oauth-client.ts` (the pattern we follow)

import {
  AtprotoDohHandleResolver,
  BrowserOAuthClient,
  type OAuthSession,
} from "@atproto/oauth-client-browser";
import { Agent } from "@atproto/api";
import { ATPROTO_BASE_SCOPE, REPO_SCOPES, getScopesForIntent } from "./scopes";
import type { AuthIntent } from "./scopes";
import { useSessionsStore } from "./store";
import type { Session } from "./types";

// Loopback dev: bake the union of every scope fieldwork might
// request into the synthesized client_id's `scope` query param so
// the auth server permits each per-intent subset declared at signIn
// time. Without this the auth server rejects the granular
// `repo:dev.idiolect.*` scopes as undeclared.
const LOOPBACK_DECLARED_SCOPES = [
  ATPROTO_BASE_SCOPE,
  ...Object.values(REPO_SCOPES),
].join(" ");

const handleResolver = new AtprotoDohHandleResolver({
  dohEndpoint: "https://dns.google/resolve",
});

/**
 * Resolve fieldwork's OAuth client id.
 *
 * - Loopback dev (localhost / 127.0.0.1 / [::1]); atproto OAuth
 *   requires the literal `http://localhost` (no port, no path).
 *   The actual port lands in `redirect_uri` instead.
 * - Production; the URL of fieldwork's deployed
 *   client-metadata.json (a static file the deploy workflow ships
 *   at `/oauth/client-metadata.json`).
 */
function getClientId(): string {
  if (typeof window === "undefined") {
    return "https://idiolect.dev/fieldwork/oauth/client-metadata.json";
  }
  const url = new URL(window.location.origin);
  if (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  ) {
    const redirect = `${window.location.origin}${import.meta.env.BASE_URL}oauth/callback`;
    const params = new URLSearchParams({
      redirect_uri: redirect,
      scope: LOOPBACK_DECLARED_SCOPES,
    });
    return `http://localhost?${params.toString()}`;
  }
  return `${window.location.origin}${import.meta.env.BASE_URL}oauth/client-metadata.json`;
}

let _client: BrowserOAuthClient | null = null;
let _initPromise: Promise<BrowserOAuthClient> | null = null;

export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;
  _initPromise = BrowserOAuthClient.load({
    clientId: getClientId(),
    handleResolver,
  }).then((client) => {
    _client = client;
    return client;
  });
  return _initPromise;
}

/**
 * Initialise the OAuth client and pick up any session waiting in
 * IndexedDB. Call once on boot. Returns the resumed `OAuthSession`
 * if the user already had one, or `null` if not.
 */
export async function resumeSession(): Promise<OAuthSession | null> {
  const client = await getOAuthClient();
  const result = await client.init();
  if (!result) return null;
  const session = "session" in result ? result.session : result;
  await syncSessionToStore(session);
  return session;
}

/**
 * Begin the sign-in flow. Redirects the browser to the user's auth
 * server; the callback URL is `<origin><base>oauth/callback` and is
 * declared in the client-metadata document.
 */
export async function startSignIn(
  handle: string,
  intent: AuthIntent,
): Promise<void> {
  const client = await getOAuthClient();
  const scope = getScopesForIntent(intent);
  // signIn navigates the browser; this promise never resolves under
  // the happy path. The catch lets us surface a structured error to
  // the UI when the auth server refuses.
  await client.signIn(handle, { scope });
}

/**
 * Sign out a single DID. Removes the session from IndexedDB and
 * from fieldwork's sessions store; if the active DID was this one,
 * `removeSession` rotates the active pointer to whatever else is
 * still signed in.
 */
export async function signOut(did: string): Promise<void> {
  const client = await getOAuthClient();
  try {
    const session = await client.restore(did);
    await session.signOut();
  } catch {
    // Session may already be gone; clearing the local store still
    // matters.
  }
  useSessionsStore.getState().removeSession(did);
}

/**
 * Build an authenticated `Agent` for the active session. The agent
 * is the surface we use to call `com.atproto.repo.createRecord`.
 *
 * Returns `null` when no active session exists, or when restoring
 * the session fails (token expired without refresh available).
 */
export async function activeAgent(): Promise<Agent | null> {
  const did = useSessionsStore.getState().activeDid;
  if (!did) return null;
  const client = await getOAuthClient();
  try {
    const session = await client.restore(did);
    // After restore, mirror the freshest token state into the store
    // so the UI shows up-to-date expiry.
    await syncSessionToStore(session);
    return new Agent(session);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("could not restore active session", did, e);
    return null;
  }
}

/**
 * Pull the bits we surface in the UI out of an `OAuthSession` and
 * write them into the sessions store. Called after every successful
 * restore / sign-in so the badge in the header reflects the current
 * handle and PDS.
 */
async function syncSessionToStore(session: OAuthSession): Promise<void> {
  const did = session.did;
  // Probe for the user's handle. PDS URL doesn't surface on
  // `OAuthSession` directly in 0.3.x; the Agent routes requests
  // through the right host via `session.fetchHandler`, so we hold
  // off on showing pdsUrl in the UI until the library exposes it
  // structurally.
  const agent = new Agent(session);
  let handle: string | undefined;
  let avatar: string | undefined;
  let displayName: string | undefined;
  let pdsUrl = "";
  try {
    const profile = await agent.com.atproto.repo.describeRepo({ repo: did });
    handle = profile.data.handle;
  } catch {
    // fall through with whatever we already have.
  }
  // Resolve the user's PDS via the DID document. plc.directory
  // serves the canonical doc for did:plc:* DIDs and is open-CORS;
  // failure leaves pdsUrl empty so callers fall back to a generic
  // placeholder.
  try {
    const r = await fetch(`https://plc.directory/${did}`);
    if (r.ok) {
      const doc: {
        service?: Array<{ id: string; serviceEndpoint: string }>;
      } = await r.json();
      const svc = doc.service?.find((s) => s.id === "#atproto_pds");
      if (svc?.serviceEndpoint) {
        pdsUrl = svc.serviceEndpoint.replace(/\/$/, "");
      }
    }
  } catch {
    /* fall through with empty pdsUrl */
  }
  // Avatar + display name come from bsky's public AppView; the PDS
  // doesn't necessarily proxy app.bsky.* calls (the user's PDS will
  // 401 / 403 if it doesn't), and the profile data we want here is
  // public anyway. Failure is non-fatal; the badge falls back to a
  // handle-initial avatar.
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
    const r = await fetch(url);
    if (r.ok) {
      const profile = (await r.json()) as {
        avatar?: string;
        displayName?: string;
        handle?: string;
      };
      avatar = profile.avatar;
      displayName = profile.displayName;
      handle = handle ?? profile.handle;
    }
  } catch {
    // fall through
  }
  // Pull granted scope + expiry from live token info so the
  // publish-side scope-guard can warn early. Failure is non-fatal.
  let scope: string | null = null;
  let expiresAt: number | null = null;
  try {
    const info = await session.getTokenInfo("auto");
    scope = info.scope ?? null;
    expiresAt = info.expiresAt?.getTime() ?? null;
  } catch {
    // fall through
  }
  const next: Session = {
    did,
    handle,
    avatar,
    displayName,
    pdsUrl,
    label: handle ?? did,
    accessJwt: "",
    refreshJwt: "",
    dpopJwk: null,
    dpopNonce: null,
    authServer: null,
    expiresAt,
    scope,
  };
  useSessionsStore.getState().upsertSession(next);
}
