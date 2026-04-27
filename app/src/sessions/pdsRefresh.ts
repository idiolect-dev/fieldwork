// Tiny shared signal that bumps every time a fieldwork action
// writes to or deletes from the active session's PDS. Components
// listing PDS records (Sidebar's PublishedList, LensManager) watch
// the counter so they re-fetch on the next tick after a publish or
// delete from anywhere in the app.

import { create } from "zustand";

export interface PdsRefreshState {
  tick: number;
  /** Notify subscribers that the active session's PDS has changed. */
  bump: () => void;
}

export const usePdsRefresh = create<PdsRefreshState>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));
