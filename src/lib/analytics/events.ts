// Catalogue typé des événements comportementaux (table analytics_events).
// Volontairement court — seulement ce qui n'est dérivable d'aucune table
// existante (voir le plan de tracking). Toute nouvelle métrique doit
// d'abord vérifier si elle peut être calculée à partir des tables métier
// avant d'ajouter une entrée ici.

export type AnalyticsEventName =
  | "signup_completed"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "search_performed"
  | "search_action"
  | "session_started"
  | "pwa_install_prompt_responded"
  | "pwa_installed"
  | "push_permission_requested";

export type AnalyticsEventProperties = {
  signup_completed: Record<string, never>;
  onboarding_step_completed: { step: number; stepName: string };
  onboarding_completed: { bioProvided: boolean; interestCount: number };
  search_performed: {
    mode: "name" | "discover";
    resultCount: number;
    city: string | null;
  };
  search_action: {
    mode: "name" | "discover";
    actionType: "add_friend" | "message";
  };
  session_started: Record<string, never>;
  pwa_install_prompt_responded: { outcome: "accepted" | "dismissed" };
  pwa_installed: Record<string, never>;
  push_permission_requested: { result: "granted" | "denied" | "default" };
};

export type PropertiesFor<N extends AnalyticsEventName> = AnalyticsEventProperties[N];
