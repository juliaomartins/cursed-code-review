"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setItems((all) => [...all.slice(-2), { ...t, id }]);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, item.durationMs ?? 5000);
    return () => clearTimeout(t);
  }, [item.durationMs, onDismiss]);
  return (
    <div
      role="status"
      className={cx(
        "codex-frame pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur",
        item.tone === "error" ? "border-sev-high/60" : item.tone === "success" ? "border-banished/40" : "border-line-strong",
      )}
    >
      <span className={cx("mt-0.5", item.tone === "error" ? "text-sev-high" : item.tone === "success" ? "text-banished" : "text-ember")}>
        <Icon name={item.tone === "error" ? "alert" : item.tone === "success" ? "check" : "flame"} size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="m-0 text-sm font-bold text-ink">{item.title}</p>
        {item.description && <p className="m-0 text-[13px] text-ink-3">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
          className="min-h-9 rounded-lg px-2.5 text-sm font-bold text-ember-soft hover:bg-ember/10"
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-4 hover:bg-white/5 hover:text-ink">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
