import type { ReactNode } from "react";

/**
 * Pill-style tab for a page's top-level content-type toggle (e.g. Groups'
 * Discover/My groups, Discover's Both/Events/Activities) — shared across
 * pages that need this exact shape. Not for secondary filter panels inside
 * a page (those use their own, deliberately different, underline style —
 * see FilterTabButton in groups-page-client.tsx).
 */
export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-2 py-2.5 text-[13px] font-bold transition-colors sm:px-4 sm:text-sm ${
        active ? "text-white" : "text-muted"
      }`}
      style={active ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {children}
    </button>
  );
}
