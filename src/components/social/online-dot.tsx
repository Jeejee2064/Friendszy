"use client";

import { usePresence } from "@/lib/presence/presence-context";

export function OnlineDot({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const onlineIds = usePresence();
  if (!onlineIds.has(userId)) return null;

  return (
    <span
      className={`block rounded-full border-2 border-card bg-[#22c55e] ${className ?? ""}`}
    />
  );
}
