// Per-DID session state.
//
// fieldwork supports authenticating multiple atproto identities at
// once; useful when a single human curates records under both a
// personal DID and a community DID, or when one user shepherds
// records for several communities. Sessions are identified by DID.

export interface Session {
  /** atproto DID this session authenticates (`did:plc:...`). */
  did: string;
  /** Human-friendly handle as resolved at sign-in time. */
  handle?: string;
  /** Avatar URL from the user's bsky profile, when resolvable. */
  avatar?: string;
  /** Display name from the user's bsky profile, when resolvable. */
  displayName?: string;
  /** Base URL of the user's PDS (resolved from DID document). */
  pdsUrl: string;
  /** Display label the user picked, falls back to handle ?? did. */
  label: string;
  /** Bearer access token for PDS xrpc calls. */
  accessJwt: string;
  /** Refresh token used to renew accessJwt without a re-login. */
  refreshJwt: string;
  /** DPoP key (raw export); regenerated on stale-key responses. */
  dpopJwk: JsonWebKey | null;
  /** Server-issued DPoP nonce, rotated by every PDS response. */
  dpopNonce: string | null;
  /** Auth-server endpoint that minted these tokens. */
  authServer: string | null;
  /** Time the access token expires (ms since epoch). */
  expiresAt: number | null;
  /**
   * Granted OAuth scope string (space-separated). `null` when the
   * library hasn't surfaced it yet; the publish-side guard treats
   * null as "let the PDS decide" and skips its early-warn.
   */
  scope: string | null;
}
