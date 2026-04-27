// Lightweight tooltip wrapper.
//
// Shows a small floating bubble on hover or focus. CSS-driven (no
// portal, no JS positioning); the bubble lives inside the wrapper
// span so the parent component doesn't need to coordinate refs.
//
// Use sparingly — the icon-button title attribute already covers
// the easy cases. Reach for this when the explanation is more than
// one phrase or needs to wrap.

import type { ReactNode } from "react";

interface Props {
  text: ReactNode;
  /** "top" | "bottom" (default "top"). */
  placement?: "top" | "bottom";
  children: ReactNode;
}

export function Tooltip({ text, placement = "top", children }: Props) {
  const placementClass =
    placement === "top"
      ? "bottom-full mb-1 left-1/2 -translate-x-1/2"
      : "top-full mt-1 left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 ${placementClass} max-w-xs whitespace-normal rounded bg-stone-900 text-stone-100 text-[11px] leading-snug px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 shadow-lg`}
      >
        {text}
      </span>
    </span>
  );
}
