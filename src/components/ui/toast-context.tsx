"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

type Toast = { id: string; message: string; href: string };
type ShowToast = (toast: { message: string; href: string }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ShowToast>(
    ({ message, href }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, href }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{ animation: "toast-in 0.2s ease-out" }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg"
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
              aria-label="close"
              className="shrink-0 text-muted"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
