import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  actions,
  onBack,
  backLabel,
}: {
  title: string;
  actions?: ReactNode;
  /** When set, renders a back button before the title — pass `() => router.back()` so it returns to whichever view (list or map) the caller actually came from, rather than a fixed destination. */
  onBack?: () => void;
  /** Required (a11y label) whenever `onBack` is set. */
  backLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 py-4 md:px-10">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-teal2"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        )}
        <h1 className="truncate text-xl font-extrabold text-text md:text-2xl">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
