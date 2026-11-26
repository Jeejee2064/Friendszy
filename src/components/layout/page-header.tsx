import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";

export function PageHeader({
  title,
  actions,
  leading,
  onBack,
  backLabel,
}: {
  title: string;
  actions?: ReactNode;
  /** Rendered before the title (e.g. the user's avatar). */
  leading?: ReactNode;
  /** When set, renders a back button before the title — pass `() => router.back()` so it returns to whichever view (list or map) the caller actually came from, rather than a fixed destination. */
  onBack?: () => void;
  /** Required (a11y label) whenever `onBack` is set. */
  backLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 py-4 md:px-10">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        {onBack && <BackButton onClick={onBack} label={backLabel ?? ""} />}
        <h1 className="truncate text-xl font-extrabold text-text md:text-2xl">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
