// Placeholders de chargement (shimmer teal) — affichés instantanément par les
// loading.tsx pendant que la page serveur récupère ses données.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function SkeletonAvatar({ size = "h-12 w-12" }: { size?: string }) {
  return <Skeleton className={`${size} shrink-0 rounded-full`} />;
}
