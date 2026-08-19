// atproto OAuth scopes for fieldwork.
//
// fieldwork is a curation workshop; every published record body
// lives under `dev.idiolect.*`. We use atproto's granular scope
// spec (repo: / blob: / include:) to ask only for what each tool
// needs, mirroring the pattern Chive established. The default cut
// emits individual `repo:` scopes; once the `dev.idiolect.auth.*`
// permission-set lexicons are published and resolvable, flip
// `USE_PERMISSION_SETS` to switch to `include:` references.
//
// References:
// - https://atproto.com/specs/oauth (atproto OAuth)
// - chive's `web/lib/auth/scopes.ts` (the precedent we follow)

/**
 * Permission tiers fieldwork supports.
 *
 * - `read-only`; no record-publish capability; the user can still
 *   import / edit / export drafts but the "Publish to PDS" button
 *   stays disabled.
 * - `curator`; every `dev.idiolect.*` collection fieldwork's tools
 *   can publish: dialect, vocab, community, recommendation. The
 *   default for the "Sign in" button.
 * - `full`; adds the auxiliary collections (belief, encounter,
 *   correction, observation, retrospection, verification, bounty)
 *   for users who want fieldwork to act as a richer record-curation
 *   surface as it grows.
 */
export type AuthIntent = "read-only" | "curator" | "full";

/**
 * `dev.idiolect.auth.*` permission-set references.
 *
 * Not in OAuth requests yet; the auth-server has to resolve the
 * NSID from idiolect's domain. Once a `_lexicon.auth.idiolect.dev`
 * DNS TXT record (or `/.well-known/atproto-lexicons/`) is in place
 * pointing at the DID that owns the namespace, flip
 * `USE_PERMISSION_SETS` and these replace the individual `repo:`
 * scopes below.
 */
export const PERMISSION_SETS = {
  CURATOR: "include:dev.idiolect.auth.curatorAccess",
  FULL: "include:dev.idiolect.auth.fullAccess",
} as const;

/** atproto base scope; always required. */
export const ATPROTO_BASE_SCOPE = "atproto";

/**
 * Pre-permission-set fallback: individual `repo:` scopes per
 * `dev.idiolect.*` collection.
 */
export const REPO_SCOPES = {
  DIALECT: "repo:dev.idiolect.dialect",
  VOCAB: "repo:dev.idiolect.vocab",
  COMMUNITY: "repo:dev.idiolect.community",
  RECOMMENDATION: "repo:dev.idiolect.recommendation",
  DELIBERATION: "repo:dev.idiolect.deliberation",
  DELIBERATION_STATEMENT: "repo:dev.idiolect.deliberationStatement",
  DELIBERATION_OUTCOME: "repo:dev.idiolect.deliberationOutcome",
  // No `repo:dev.panproto.schema.lens` here. fieldwork used to accept a
  // pasted lens body and publish it, which needed the write scope. Since
  // protolab 0.8.0 publishes lenses itself, fieldwork only *reads* them —
  // and listing public records is unauthenticated — so requesting a write
  // scope it never exercises would be asking for more than it uses.

  BELIEF: "repo:dev.idiolect.belief",
  ENCOUNTER: "repo:dev.idiolect.encounter",
  CORRECTION: "repo:dev.idiolect.correction",
  OBSERVATION: "repo:dev.idiolect.observation",
  RETROSPECTION: "repo:dev.idiolect.retrospection",
  VERIFICATION: "repo:dev.idiolect.verification",
  BOUNTY: "repo:dev.idiolect.bounty",
  DELIBERATION_VOTE: "repo:dev.idiolect.deliberationVote",
} as const;

const CURATOR_REPO_SCOPES = [
  REPO_SCOPES.DIALECT,
  REPO_SCOPES.VOCAB,
  REPO_SCOPES.COMMUNITY,
  REPO_SCOPES.RECOMMENDATION,
  REPO_SCOPES.DELIBERATION,
  REPO_SCOPES.DELIBERATION_STATEMENT,
  REPO_SCOPES.DELIBERATION_OUTCOME,
];

const FULL_REPO_SCOPES = [
  ...CURATOR_REPO_SCOPES,
  REPO_SCOPES.BELIEF,
  REPO_SCOPES.ENCOUNTER,
  REPO_SCOPES.CORRECTION,
  REPO_SCOPES.OBSERVATION,
  REPO_SCOPES.RETROSPECTION,
  REPO_SCOPES.VERIFICATION,
  REPO_SCOPES.BOUNTY,
  REPO_SCOPES.DELIBERATION_VOTE,
];

/** Permission-set hierarchy, least-to-most permissive. */
const PERMISSION_HIERARCHY = [
  PERMISSION_SETS.CURATOR,
  PERMISSION_SETS.FULL,
] as const;

/**
 * Build-time flag: when true, request `include:` permission-set
 * references in place of individual `repo:` scopes.
 *
 * Read from Vite's `VITE_USE_PERMISSION_SETS` env var. Safe to flip
 * to `"true"` only after the auth-server can resolve
 * `dev.idiolect.auth.{curatorAccess,fullAccess}`.
 */
const USE_PERMISSION_SETS =
  import.meta.env.VITE_USE_PERMISSION_SETS === "true";

/** Map an intent to the matching permission set reference. */
function permissionSetFor(intent: AuthIntent): string | null {
  switch (intent) {
    case "read-only":
      return null;
    case "curator":
      return PERMISSION_SETS.CURATOR;
    case "full":
      return PERMISSION_SETS.FULL;
  }
}

/**
 * The space-separated scope string to request for `intent`.
 *
 * Always includes `atproto` (the base scope). For non-`read-only`
 * intents, includes either a permission-set `include:` reference or
 * the equivalent set of individual `repo:` scopes depending on the
 * `VITE_USE_PERMISSION_SETS` build flag.
 */
export function getScopesForIntent(intent: AuthIntent): string {
  const parts = [ATPROTO_BASE_SCOPE];
  if (intent === "read-only") return parts.join(" ");
  if (USE_PERMISSION_SETS) {
    const ref = permissionSetFor(intent);
    if (ref) parts.push(ref);
    return parts.join(" ");
  }
  const repos = intent === "full" ? FULL_REPO_SCOPES : CURATOR_REPO_SCOPES;
  parts.push(...repos);
  return parts.join(" ");
}

/**
 * True if the granted scopes satisfy the requirement.
 *
 * Honours the permission-set hierarchy (full ≥ curator) and treats
 * `transition:generic` as wildcard for backward compatibility.
 */
export function hasScope(
  grantedScopes: readonly string[],
  required: string,
): boolean {
  if (grantedScopes.includes("transition:generic")) return true;
  if (grantedScopes.includes(required)) return true;
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(
    required as (typeof PERMISSION_HIERARCHY)[number],
  );
  if (requiredIndex >= 0) {
    return grantedScopes.some((s) => {
      const grantedIndex = PERMISSION_HIERARCHY.indexOf(
        s as (typeof PERMISSION_HIERARCHY)[number],
      );
      return grantedIndex >= 0 && grantedIndex >= requiredIndex;
    });
  }
  return false;
}

/**
 * Map a `DraftKind` to the `repo:` scope a publish would need. Used
 * by the publish button to render a "missing scope" warning when the
 * user signed in with a tier that doesn't cover the active draft.
 */
export function repoScopeForKind(kind: string): string | null {
  switch (kind) {
    case "dialect":
      return REPO_SCOPES.DIALECT;
    case "vocab":
      return REPO_SCOPES.VOCAB;
    case "community":
      return REPO_SCOPES.COMMUNITY;
    case "recommendation":
      return REPO_SCOPES.RECOMMENDATION;
    default:
      return null;
  }
}
