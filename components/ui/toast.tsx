"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";

type Toast = { id: number; message: string; tone: "success" | "error" };

const ToastContext = createContext<((message: string, tone?: Toast["tone"]) => void) | null>(null);

/** Confirmation after an action ("Reserva creada", "Cobro registrado"). Bottom center, 4 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex items-center gap-2.5 rounded-md bg-ink px-4 py-3 text-label font-semibold text-white shadow-menu"
          >
            <Icon
              name={toast.tone === "success" ? "check" : "alert"}
              size={18}
              strokeWidth={2.6}
              className={cn(toast.tone === "success" ? "text-energy-lime" : "text-danger-line")}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
