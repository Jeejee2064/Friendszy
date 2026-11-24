import type { ReactNode } from "react";
import { PageTransition } from "@/components/ui/page-transition";

// Un template est remonté à chaque navigation (contrairement au layout) :
// c'est ce qui rejoue le fondu d'entrée.
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
