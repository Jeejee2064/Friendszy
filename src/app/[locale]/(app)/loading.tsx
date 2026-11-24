import { cookies } from "next/headers";
import { HomeSkeleton, RouteProgress } from "@/components/ui/skeleton-screens";

// Seule la route "/" tombe ici (chaque autre écran a son propre loading.tsx).
// Un visiteur anonyme y voit la page d'atterrissage publique, sans l'habillage
// de l'app : on ne lui montre donc pas le squelette de l'accueil connecté.
export default async function Loading() {
  const jar = await cookies();
  const hasSession = jar.getAll().some((c) => c.name.startsWith("sb-"));
  return hasSession ? <HomeSkeleton /> : <RouteProgress />;
}
