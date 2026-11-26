"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton, SkeletonAvatar } from "./skeleton";

// Quand l'URL porte ?c=<conversation> (lien depuis une notification, retour
// arrière…), la vraie page affiche le chat en plein écran par-dessus la liste
// (fixed inset-0). Le squelette fait pareil, sinon on verrait d'abord la liste
// puis un saut vers le chat. Ne dépend que de l'URL : rien à fetcher.
export function MessagesOpenSkeleton() {
  const open = useSearchParams().get("c");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex h-dvh min-w-0 flex-col overflow-hidden bg-card">
      <div className="safe-top flex items-center gap-3 border-b border-border p-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <SkeletonAvatar size="h-10 w-10" />
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden p-4">
        <Skeleton className="h-10 w-2/3 max-w-sm rounded-2xl rounded-bl-md" />
        <Skeleton className="ml-auto h-10 w-1/2 max-w-xs rounded-2xl rounded-br-md" />
        <Skeleton className="h-14 w-3/5 max-w-md rounded-2xl rounded-bl-md" />
        <Skeleton className="ml-auto h-10 w-2/5 max-w-[16rem] rounded-2xl rounded-br-md" />
      </div>
      <div className="border-t border-border p-3">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
