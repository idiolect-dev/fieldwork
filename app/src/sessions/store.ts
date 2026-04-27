// Sessions slice; kept separate from `workspace/store.ts` so OAuth
// state doesn't pollute draft persistence and vice-versa. Sessions
// persist to localStorage under a different key so a user clearing
// drafts doesn't accidentally log themselves out, and clearing
// auth doesn't lose drafts.

import { create } from "zustand";
import type { Session } from "./types";

interface SessionsState {
  sessions: Record<string, Session>;
  /** DID of the session currently used for export/publish actions. */
  activeDid: string | null;

  upsertSession: (s: Session) => void;
  removeSession: (did: string) => void;
  setActiveDid: (did: string | null) => void;
  patchSession: (did: string, partial: Partial<Session>) => void;
}

const STORAGE_KEY = "fieldwork.sessions.v1";

interface PersistedShape {
  sessions: Record<string, Session>;
  activeDid: string | null;
}

function load(): PersistedShape | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
}

function persist(state: SessionsState): void {
  if (typeof localStorage === "undefined") return;
  const payload: PersistedShape = {
    sessions: state.sessions,
    activeDid: state.activeDid,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / privacy mode
  }
}

const persisted = load();

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: persisted?.sessions ?? {},
  activeDid: persisted?.activeDid ?? null,

  upsertSession: (s) =>
    set((state) => {
      const sessions = { ...state.sessions, [s.did]: s };
      const activeDid = state.activeDid ?? s.did;
      const next = { ...state, sessions, activeDid };
      persist(next);
      return { sessions, activeDid };
    }),

  removeSession: (did) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[did];
      const activeDid =
        state.activeDid === did
          ? (Object.keys(sessions)[0] ?? null)
          : state.activeDid;
      const next = { ...state, sessions, activeDid };
      persist(next);
      return { sessions, activeDid };
    }),

  setActiveDid: (did) =>
    set((state) => {
      const next = { ...state, activeDid: did };
      persist(next);
      return { activeDid: did };
    }),

  patchSession: (did, partial) =>
    set((state) => {
      const existing = state.sessions[did];
      if (!existing) return state;
      const sessions = {
        ...state.sessions,
        [did]: { ...existing, ...partial },
      };
      const next = { ...state, sessions };
      persist(next);
      return { sessions };
    }),
}));

export function activeSession(): Session | null {
  const state = useSessionsStore.getState();
  if (!state.activeDid) return null;
  return state.sessions[state.activeDid] ?? null;
}
