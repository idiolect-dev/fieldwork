// Zustand store for the in-memory workspace.
//
// The store mirrors `fieldwork-core`'s Workspace shape but lives
// in TypeScript so React can subscribe to slices without rebuilding
// the WASM bridge on every keystroke. We only cross the WASM bridge
// for the few operations that need parser / validator help (at-uri
// parse, draft import, guidance compute, export render).

import { create } from "zustand";
import { draftId } from "./types";
import type { Draft, DraftKind } from "./types";

export type ToolKey =
  | "dialect"
  | "vocab"
  | "lexicon"
  | "community"
  | "recommendation"
  | "lens";

export interface AppViewSettings {
  /** Base URL used to resolve `at://` imports. */
  baseUrl: string;
}

interface WorkspaceState {
  tool: ToolKey;
  drafts: Record<string, Draft>;
  /** Order shown in the sidebar; insertion order, drift-tolerant. */
  draftOrder: string[];
  /** Active draft id per kind (the one a tool's form is bound to). */
  active: Partial<Record<DraftKind, string>>;
  /**
   * Snapshot of each draft's record body at import time (or the
   * last "promote to baseline" action). The diff view uses this to
   * show what fields the user has changed since import. Map key =
   * draft id; value = the inner record body. Absent for drafts the
   * user created from scratch and hasn't snapshotted.
   */
  originals: Record<string, unknown>;
  /** Browser-side settings persisted to localStorage. */
  appView: AppViewSettings;
  /** DID prefilled into export commands. */
  publishingDid: string;

  setTool: (t: ToolKey) => void;
  upsertDraft: (d: Draft) => void;
  /**
   * Insert a draft and stamp the current body as its "original"
   * snapshot. Use this on import (file / fixture / at-uri) so the
   * diff pane has something to compare against.
   */
  importDraft: (d: Draft) => void;
  /** Replace the original snapshot with the current body. */
  snapshotDraft: (id: string) => void;
  removeDraft: (id: string) => void;
  setActive: (kind: DraftKind, id: string | undefined) => void;
  setAppView: (s: Partial<AppViewSettings>) => void;
  setPublishingDid: (did: string) => void;
  /**
   * Stamp a draft as having a counterpart on the user's PDS. The
   * snapshot field freezes the JSON-serialised body at the moment
   * of publish so drift detection knows when the local body has
   * diverged. Pass `null` to clear the link (e.g. after a delete).
   */
  setPublishedRef: (id: string, ref: { uri: string; cid: string } | null) => void;
  /**
   * Restore a published-ref'd draft's body to the JSON snapshot
   * that was stamped at publish time. Used by the editor's
   * "Revert to PDS" button. No-op for drafts without a publishedRef.
   */
  revertToPublished: (id: string) => void;
}

const STORAGE_KEY = "fieldwork.workspace.v1";

interface PersistedShape {
  drafts: Record<string, Draft>;
  draftOrder: string[];
  active: Partial<Record<DraftKind, string>>;
  originals: Record<string, unknown>;
  appView: AppViewSettings;
  publishingDid: string;
}

function loadPersisted(): PersistedShape | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
}

function persist(state: WorkspaceState): void {
  if (typeof localStorage === "undefined") return;
  const payload: PersistedShape = {
    drafts: state.drafts,
    draftOrder: state.draftOrder,
    active: state.active,
    originals: state.originals,
    appView: state.appView,
    publishingDid: state.publishingDid,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage quota / privacy mode; silently skip.
  }
}

function recordBody(d: Draft): unknown {
  return d.body.body;
}

const persisted = loadPersisted();

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tool: "dialect",
  drafts: persisted?.drafts ?? {},
  draftOrder: persisted?.draftOrder ?? [],
  active: persisted?.active ?? {},
  originals: persisted?.originals ?? {},
  appView: persisted?.appView ?? {
    baseUrl: "https://public.api.bsky.app",
  },
  publishingDid: persisted?.publishingDid ?? "",

  setTool: (tool) => set({ tool }),

  upsertDraft: (draft) =>
    set((s) => {
      const id = draftId(draft);
      const drafts = { ...s.drafts, [id]: draft };
      const draftOrder = s.draftOrder.includes(id)
        ? s.draftOrder
        : [...s.draftOrder, id];
      const active = { ...s.active, [draft.kind]: id };
      const next = { ...s, drafts, draftOrder, active };
      persist(next);
      return { drafts, draftOrder, active };
    }),

  importDraft: (draft) =>
    set((s) => {
      const id = draftId(draft);
      const drafts = { ...s.drafts, [id]: draft };
      const draftOrder = s.draftOrder.includes(id)
        ? s.draftOrder
        : [...s.draftOrder, id];
      const active = { ...s.active, [draft.kind]: id };
      // Deep-clone via JSON so subsequent edits don't mutate the
      // snapshot. The inner body is plain JSON; no functions, no
      // class instances; so JSON.parse is a complete clone.
      const originals = {
        ...s.originals,
        [id]: JSON.parse(JSON.stringify(recordBody(draft))) as unknown,
      };
      const next = { ...s, drafts, draftOrder, active, originals };
      persist(next);
      return { drafts, draftOrder, active, originals };
    }),

  snapshotDraft: (id) =>
    set((s) => {
      const draft = s.drafts[id];
      if (!draft) return s;
      const originals = {
        ...s.originals,
        [id]: JSON.parse(JSON.stringify(recordBody(draft))) as unknown,
      };
      const next = { ...s, originals };
      persist(next);
      return { originals };
    }),

  removeDraft: (id) =>
    set((s) => {
      const drafts = { ...s.drafts };
      delete drafts[id];
      const draftOrder = s.draftOrder.filter((x) => x !== id);
      const active = { ...s.active };
      for (const k of Object.keys(active) as DraftKind[]) {
        if (active[k] === id) delete active[k];
      }
      const originals = { ...s.originals };
      delete originals[id];
      const next = { ...s, drafts, draftOrder, active, originals };
      persist(next);
      return { drafts, draftOrder, active, originals };
    }),

  setActive: (kind, id) =>
    set((s) => {
      const active = { ...s.active };
      if (id === undefined) delete active[kind];
      else active[kind] = id;
      const next = { ...s, active };
      persist(next);
      return { active };
    }),

  setAppView: (partial) =>
    set((s) => {
      const appView = { ...s.appView, ...partial };
      const next = { ...s, appView };
      persist(next);
      return { appView };
    }),

  setPublishingDid: (publishingDid) =>
    set((s) => {
      const next = { ...s, publishingDid };
      persist(next);
      return { publishingDid };
    }),

  setPublishedRef: (id, ref) =>
    set((s) => {
      const existing = s.drafts[id];
      if (!existing) return s;
      const nextBody = ref
        ? {
            ...existing.body,
            publishedRef: {
              uri: ref.uri,
              cid: ref.cid,
              snapshot: JSON.stringify(existing.body.body),
            },
          }
        : (() => {
            // Strip the publishedRef without leaving an `undefined`
            // serialised into localStorage.
            const { publishedRef: _drop, ...rest } = existing.body;
            return rest;
          })();
      const nextDraft = { ...existing, body: nextBody } as Draft;
      const drafts = { ...s.drafts, [id]: nextDraft };
      const next = { ...s, drafts };
      persist(next);
      return { drafts };
    }),

  revertToPublished: (id) =>
    set((s) => {
      const existing = s.drafts[id];
      if (!existing?.body.publishedRef) return s;
      let parsed: unknown;
      try {
        parsed = JSON.parse(existing.body.publishedRef.snapshot);
      } catch {
        return s;
      }
      const nextDraft = {
        ...existing,
        body: {
          ...existing.body,
          body: parsed as typeof existing.body.body,
        },
      } as Draft;
      const drafts = { ...s.drafts, [id]: nextDraft };
      const next = { ...s, drafts };
      persist(next);
      return { drafts };
    }),
}));

/** Read-only helper: every draft of a given kind, in sidebar order. */
export function draftsByKind<K extends DraftKind>(
  state: WorkspaceState,
  kind: K,
): Array<Draft & { kind: K }> {
  return state.draftOrder
    .map((id) => state.drafts[id])
    .filter(
      (d): d is Draft & { kind: K } => d !== undefined && d.kind === kind,
    );
}
