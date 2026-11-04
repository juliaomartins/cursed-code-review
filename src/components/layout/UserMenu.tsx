"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, hydrated, requestSignIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hydrated) return <span className="skeleton block h-11 w-44 rounded-[10px]" aria-hidden="true" />;

  if (!user)
    return (
      <Button onClick={requestSignIn} variant="outline" aria-label={compact ? "Sign in with GitHub" : undefined}>
        <Icon name="github" />
        <span className={compact ? "hidden sm:inline" : undefined}>Sign in with GitHub</span>
      </Button>
    );

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong py-1 pr-3 pl-1 text-sm font-medium text-ink hover:border-ink-4"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5865e6] to-[#b23f8e] text-xs font-bold">{initials}</span>
        <span className="hidden sm:inline">@{user.login}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 animate-rise overflow-hidden rounded-xl border border-line bg-card-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="border-b border-line px-4 py-3">
            <p className="m-0 text-xs text-ink-3">Signed in as</p>
            <p className="m-0 text-sm font-bold">{user.name}</p>
            <p className="m-0 font-mono text-xs text-ink-3">@{user.login}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm text-ink-2 hover:bg-white/5 hover:text-ink"
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
