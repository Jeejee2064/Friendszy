"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SPRING } from "@/lib/motion";
import { useRouter } from "@/i18n/navigation";

type ToastInput = {
  // Texte fixe, ou fonction du nombre d'occurrences quand `groupKey` regroupe
  // plusieurs toasts (« 3 nouveaux messages de Léa »).
  message: string | ((count: number) => string);
  href: string;
  // Deux toasts de même clé n'en font qu'un : le texte est mis à jour, le
  // compteur monte et le délai repart.
  groupKey?: string;
};

type Toast = { id: string; message: string; href: string; groupKey?: string; count: number };
type ShowToast = (toast: ToastInput) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;
const SWIPE_DISMISS_PX = 80;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const t = useTranslations("Common");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counts = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => {
      const gone = prev.find((toast) => toast.id === id);
      if (gone?.groupKey) counts.current.delete(gone.groupKey);
      return prev.filter((toast) => toast.id !== id);
    });
  }, []);

  const arm = useCallback(
    (id: string) => {
      const previous = timers.current.get(id);
      if (previous) clearTimeout(previous);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const showToast = useCallback<ShowToast>(
    ({ message, href, groupKey }) => {
      const count = groupKey ? (counts.current.get(groupKey) ?? 0) + 1 : 1;
      if (groupKey) counts.current.set(groupKey, count);
      const text = typeof message === "function" ? message(count) : message;

      setToasts((prev) => {
        const existing = groupKey ? prev.find((toast) => toast.groupKey === groupKey) : undefined;
        if (existing) {
          arm(existing.id);
          return prev.map((toast) =>
            toast.id === existing.id ? { ...toast, message: text, href, count } : toast
          );
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        arm(id);
        // Au-delà du maximum, la plus ancienne cède la place.
        const next = [...prev, { id, message: text, href, groupKey, count }];
        const overflow = next.length - MAX_VISIBLE;
        if (overflow > 0) {
          next.slice(0, overflow).forEach((old) => {
            const timer = timers.current.get(old.id);
            if (timer) clearTimeout(timer);
            timers.current.delete(old.id);
            if (old.groupKey) counts.current.delete(old.groupKey);
          });
          return next.slice(overflow);
        }
        return next;
      });
    },
    [arm]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* Sous la barre native (--native-top, posée par NativeChrome) ; hors app
          native la variable n'existe pas et on retombe sur la zone sûre de l'écran. */}
      <div
        role="region"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--native-top,env(safe-area-inset-top,0px))+0.75rem)] z-50 flex flex-col gap-2 px-4 sm:inset-x-auto sm:right-4 sm:w-96 sm:px-0 [&>*]:pointer-events-auto"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > SWIPE_DISMISS_PX) dismiss(toast.id);
              }}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={SPRING.overlay}
              className="flex touch-pan-y items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg"
            >
              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                  router.push(toast.href);
                }}
                className="flex-1 text-left text-sm font-semibold text-text"
              >
                🔔 {toast.message}
              </button>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t("close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-muted"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
