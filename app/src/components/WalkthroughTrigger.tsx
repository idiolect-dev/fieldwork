// Small "?" icon that opens the global walkthrough at a specific
// flow. Use one per tool header so users can re-enter that tool's
// tour after dismissing it.

import { useWalkthroughStore } from "./walkthroughStore";

interface Props {
  /** Flow key to open. Omit to open the hub instead. */
  flow?: string;
  title?: string;
}

export function WalkthroughTrigger({ flow, title }: Props) {
  const open = useWalkthroughStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={() => open(flow)}
      className="text-stone-400 hover:text-stone-700 text-sm w-6 h-6 inline-flex items-center justify-center rounded-full border border-stone-300 hover:border-stone-500"
      aria-label="Open walkthrough"
      title={title ?? (flow ? `Show the ${flow} walkthrough` : "Show walkthrough")}
    >
      ?
    </button>
  );
}
