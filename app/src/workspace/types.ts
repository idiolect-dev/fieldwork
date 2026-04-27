// TypeScript shape of `fieldwork-core::Draft` and friends.
//
// Record bodies pull straight from `@idiolect-dev/schema`'s
// generated types; same Rust → idiolect-records → tsc lineage as
// everything else in the federation, no shape drift between
// fieldwork's edits and what subscribers expect.

import type {
  Community,
  Dialect,
  Recommendation,
  Vocab,
} from "@idiolect-dev/schema";

export type DraftKind =
  | "dialect"
  | "vocab"
  | "community"
  | "recommendation";

export type Draft =
  | { kind: "dialect"; body: DialectDraftBody }
  | { kind: "vocab"; body: VocabDraftBody }
  | { kind: "community"; body: CommunityDraftBody }
  | { kind: "recommendation"; body: RecommendationDraftBody };

export interface DraftEnvelope<B extends object> {
  id: string;
  label: string;
  // Intersect the typed wire-form record with a string-indexed view
  // so editors can patch fields by string key (`body[field] = …`)
  // without losing the per-field types on direct access (`body.name`).
  body: B & Record<string, unknown>;
  /**
   * When the draft has a counterpart published to the user's PDS,
   * we record the at-uri / cid plus a JSON snapshot of the body at
   * publish time. The snapshot is used to detect drift: if the
   * current body serialises to the same string, the draft is
   * "published" (clean), or "edited-since-publication" if it differs.
   */
  publishedRef?: PublishedRef;
}

export interface PublishedRef {
  uri: string;
  cid: string;
  /** JSON snapshot of `body` at publish time. */
  snapshot: string;
}

export type DraftStatus = "draft" | "published" | "edited";

export function draftStatus(d: Draft): DraftStatus {
  const ref = d.body.publishedRef;
  if (!ref) return "draft";
  return JSON.stringify(d.body.body) === ref.snapshot
    ? "published"
    : "edited";
}

export function publishedUri(d: Draft): string | undefined {
  return d.body.publishedRef?.uri;
}

export type DialectDraftBody = DraftEnvelope<Dialect>;
export type VocabDraftBody = DraftEnvelope<Vocab>;
export type CommunityDraftBody = DraftEnvelope<Community>;
export type RecommendationDraftBody = DraftEnvelope<Recommendation>;

export function draftId(d: Draft): string {
  return d.body.id;
}

export function draftLabel(d: Draft): string {
  return d.body.label;
}

export function draftKind(d: Draft): DraftKind {
  return d.kind;
}

/** Type-narrow a `Draft` to a specific kind, or null. */
export function asKind<K extends DraftKind>(
  d: Draft | null | undefined,
  kind: K,
): (Draft & { kind: K }) | null {
  if (!d || d.kind !== kind) return null;
  return d as Draft & { kind: K };
}

export interface GuidanceItem {
  severity: "info" | "hint" | "warning";
  headline: string;
  detail: string;
}

export interface Guidance {
  items: GuidanceItem[];
}

export interface ExportEnvelope {
  recordJson: string;
  filename: string;
  cliCommand: string;
}
