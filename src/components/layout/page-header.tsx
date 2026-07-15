import type { ReactNode } from "react";

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4 md:px-10">
      <h1 className="text-xl font-extrabold text-text md:text-2xl">{title}</h1>
      {actions}
    </header>
  );
}
