"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { MONSTER_ORDER } from "@/lib/monsters";
import type { MonsterKind } from "@/lib/types";
import { Monster } from "../Monster";
import { Button, ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

export interface CleansedStats {
  discovered: number;
  banished: number;
  ignored: number;
  fixes: number;
  files: number;
  light: number;
  kinds: MonsterKind[];
}

const FOCUSABLE = 'a[href],button:not([disabled])';

/**
 * The finale: the last monster is gone, the sun is up. A victory card with the hunt's numbers and the way
 * to the report. Escape or "Stay in the daylight" closes it; "Undo the last banish" brings the night back.
 */
export function CryptCleansed({ stats, onClose, onUndo }: { stats: CleansedStats; onClose: () => void; onUndo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const items: [string, number | string][] = [
    ["Monsters discovered", stats.discovered],
    ["Banished", stats.banished],
    ["Ignored", stats.ignored],
    ["Fixes applied", stats.files > 1 ? `${stats.fixes} in ${stats.files} files` : stats.fixes],
    ["Room light", `${stats.light}%`],
  ];
  const kinds = MONSTER_ORDER.filter((k) => stats.kinds.includes(k));

  return (
    <div className="finale fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4" data-dialog-root="">
      <div className="finale-veil absolute inset-0" aria-hidden="true" />
      <div className="finale-rays pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finale-title"
        aria-describedby="finale-sub"
        className="finale-card relative flex w-full max-w-xl flex-col items-center gap-5 rounded-[28px] border border-line bg-card/90 px-5 py-8 text-center backdrop-blur-xl sm:px-10"
      >
        <div className="finale-spirits flex items-end justify-center gap-1" aria-hidden="true">
          {kinds.map((k, i) => (
            <span key={k} className="finale-spirit" style={{ "--i": i } as CSSProperties}>
              <Monster kind={k} size={34} glow={false} />
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.3em] text-ember-gold">DAYBREAK</span>
          <h2 id="finale-title" className="finale-title m-0 font-display text-[40px] leading-[0.95] font-bold tracking-[0.04em] text-ember-pale sm:text-[54px]">
            THE CRYPT IS CLEANSED
          </h2>
          <p id="finale-sub" className="m-0 text-[15px] text-ink-2">
            Every monster is banished. Every banishment changed the code. The sun is up.
          </p>
        </div>
        <dl className="m-0 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-5">
          {items.map(([label, value], i) => (
            <div key={label} className="finale-stat flex flex-col items-center gap-1 rounded-2xl border border-line bg-card-2 px-2 py-3" style={{ "--i": i } as CSSProperties}>
              <dd className="m-0 font-display text-[26px] leading-none font-bold text-ink">{value}</dd>
              <dt className="text-[11px] leading-tight text-ink-3">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="flex w-full flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
          <ButtonLink href="/report" variant="primary" size="lg" data-autofocus="" className="w-full sm:w-auto">
            See the final report
            <Icon name="arrowRight" />
          </ButtonLink>
          <Button variant="outline" size="lg" onClick={onClose} className="w-full sm:w-auto">
            Stay in the daylight
          </Button>
        </div>
        <button type="button" onClick={onUndo} className="min-h-11 rounded-lg px-3 text-sm text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink">
          Undo the last banish
        </button>
      </div>
    </div>
  );
}
