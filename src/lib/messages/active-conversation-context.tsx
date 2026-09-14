"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Fait remonter "quelle conversation est actuellement ouverte à l'écran"
// depuis ConversationPane (voir messages-page-client.tsx, un descendant)
// jusqu'à UnreadMessagesProvider (voir unread-context.tsx, un ancêtre dans
// le layout) — pour que le toast "nouveau message" ne s'affiche pas pour
// une conversation qu'on est déjà en train de regarder. Volontairement
// séparé de la page /messages elle-même (usePathname/useSearchParams) :
// UnreadMessagesProvider vit dans le layout racine, au-dessus de toutes
// les routes, où lire l'URL forcerait tout l'arbre à sortir du rendu
// serveur.

const ActiveConversationContext = createContext<string | null>(null);
const SetActiveConversationContext = createContext<(id: string | null) => void>(() => {});

export function useActiveConversationId() {
  return useContext(ActiveConversationContext);
}

export function useSetActiveConversationId() {
  return useContext(SetActiveConversationContext);
}

export function ActiveConversationProvider({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  return (
    <SetActiveConversationContext.Provider value={setActiveConversationId}>
      <ActiveConversationContext.Provider value={activeConversationId}>
        {children}
      </ActiveConversationContext.Provider>
    </SetActiveConversationContext.Provider>
  );
}
