// Tiny store routing the walkthrough's "open" / "go to flow" /
// "next step" actions across components. The walkthrough modal
// itself reads the state; tools / headers dispatch through it.

import { create } from "zustand";

export type WalkthroughPhase = "closed" | "hub" | "running";

export interface WalkthroughState {
  phase: WalkthroughPhase;
  activeFlow: string | null;
  stepIdx: number;
  /** Open the hub view; if a flow key is passed, jump to that flow. */
  open: (flow?: string) => void;
  /** Close the modal entirely. */
  close: () => void;
  /** Move to the next step; if at the last step, return to the hub. */
  next: () => void;
  /** Move to the previous step (no-op at step 0). */
  prev: () => void;
  /** Start a flow from the hub. */
  startFlow: (flow: string) => void;
  /** Return from a running flow back to the hub. */
  toHub: () => void;
}

export const useWalkthroughStore = create<WalkthroughState>((set) => ({
  phase: "closed",
  activeFlow: null,
  stepIdx: 0,
  open: (flow) =>
    set(() =>
      flow
        ? { phase: "running", activeFlow: flow, stepIdx: 0 }
        : { phase: "hub", activeFlow: null, stepIdx: 0 },
    ),
  close: () =>
    set({ phase: "closed", activeFlow: null, stepIdx: 0 }),
  startFlow: (flow) =>
    set({ phase: "running", activeFlow: flow, stepIdx: 0 }),
  toHub: () =>
    set({ phase: "hub", activeFlow: null, stepIdx: 0 }),
  next: () =>
    set((s) => ({ stepIdx: s.stepIdx + 1 })),
  prev: () =>
    set((s) => ({ stepIdx: Math.max(0, s.stepIdx - 1) })),
}));
