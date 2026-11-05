"use client";

import { useMemo, useRef, type CSSProperties, type MouseEvent } from "react";
import { tokenize } from "@/lib/highlight";
import { SEVERITY } from "@/lib/monsters";
import { findingLines } from "@/lib/review/apply";
import { LANGUAGE_LABEL, toLines } from "@/lib/scanner";
import type { Finding, ReviewFile } from "@/lib/types";
import { cx } from "../ui/cx";
import { MonsterChip } from "./MonsterChip";

export interface CodeViewProps {
  file: ReviewFile;
  selectedId: string | null;
  banishingId: string | null;
  lights: boolean;
  onPick: (id: string) => void;
}

export function CodeView({ file, selectedId, banishingId, lights, onPick }: CodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => toLines(file.code), [file.code]);

  const { byLine, dim, selectedLines, underline } = useMemo(() => {
    const byLine = new Map<number, Finding[]>();
    const dim = new Set<number>();
    const selectedLines = new Set<number>();
    const underline = new Map<number, string>();
    for (const f of file.findings) {
      if (f.status !== "lurking" || f.stale) continue;
      const ls = findingLines(f);
      ls.forEach((l) => {
        byLine.set(l, [...(byLine.get(l) ?? []), f]);
        if (!underline.has(l)) underline.set(l, SEVERITY[f.severity].bg);
      });
      f.dimOffsets?.forEach((o) => dim.add(f.fix.startLine + o));
      if (f.id === selectedId) {
        ls.forEach((l) => selectedLines.add(l));
        f.dimOffsets?.forEach((o) => selectedLines.add(f.fix.startLine + o));
      }
    }
    return { byLine, dim, selectedLines, underline };
  }, [file.findings, selectedId]);

  // PR mode: map current lines back to "changed" by content of the original changed lines.
  const changed = useMemo(() => {
    if (!file.changedLines) return null;
    const orig = toLines(file.originalCode);
    const texts = new Set(file.changedLines.map((n) => orig[n - 1]?.trim()).filter(Boolean));
    const out = new Set<number>();
    lines.forEach((l, i) => {
      if (l.trim() && texts.has(l.trim())) out.add(i + 1);
    });
    return out;
  }, [file.changedLines, file.originalCode, lines]);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${Math.round(e.clientX - r.left + el.scrollLeft)}px`);
    el.style.setProperty("--ly", `${Math.round(e.clientY - r.top)}px`);
  };

  const gutter = String(lines.length).length;

  return (
    <div
      className={cx(
        "overflow-hidden rounded-[14px] border font-mono text-sm shadow-[0_30px_60px_rgba(0,0,0,0.45)]",
        lights ? "lights-on border-parchment-line bg-parchment text-parchment-ink" : "border-line text-[#ECE4F6]",
      )}
    >
      <div className={cx("flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-xs", lights ? "border-parchment-line text-parchment-dim" : "border-line text-ink-4")}>
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B5B]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFB547]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#6FF2B0]" />
        <span className="ml-2 min-w-0 truncate">{file.path}</span>
        <span className="ml-auto flex items-center gap-3">
          {changed && <span className="rounded-full bg-[#6FF2B0]/15 px-2 py-0.5 text-[#9DF7C9]">{changed.size} changed lines</span>}
          {file.focusLines && (
            <span className="rounded-full bg-[#7F8CFF]/15 px-2 py-0.5 text-[#B9C1FF]">
              lines {file.focusLines[0]}–{file.focusLines[1]} from your link
            </span>
          )}
          <span>{LANGUAGE_LABEL[file.language]}</span>
          <span>{lines.length} lines</span>
        </span>
      </div>
      <div
        ref={ref}
        onMouseMove={lights ? undefined : onMove}
        role="region"
        aria-label={`Code of ${file.path}`}
        tabIndex={0}
        className="scrollbar-thin relative overflow-x-auto pt-2.5 pb-3.5"
        style={
          lights
            ? undefined
            : {
                background:
                  "radial-gradient(circle 260px at var(--lx, 320px) var(--ly, 220px), rgba(255,138,61,0.17), rgba(255,138,61,0) 72%), #110D18",
                boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)",
              }
        }
      >
        <div className="min-w-max">
          {lines.map((text, i) => {
            const n = i + 1;
            const monsters = byLine.get(n);
            const isSel = selectedLines.has(n);
            const deco = underline.get(n);
            const isChanged = changed?.has(n);
            const focused = !!file.focusLines && n >= file.focusLines[0] && n <= file.focusLines[1];
            return (
              <div
                key={n}
                id={`code-line-${n}`}
                data-line={n}
                className={cx(
                  "code-row relative flex min-h-11 flex-wrap items-center gap-x-4 px-4 transition-[background,opacity] duration-200 sm:flex-nowrap",
                  monsters && "pb-2 sm:pb-0",
                  isSel && (lights ? "bg-[#F1E6D6]" : "bg-ember/10"),
                  focused && !isSel && (lights ? "bg-[#f3eee6]" : "bg-[#7F8CFF]/[0.07]"),
                  changed && !isChanged && !monsters && "opacity-60",
                )}
              >
                {changed && (
                  <span aria-hidden="true" className={cx("absolute top-0 bottom-0 left-0 w-[3px]", isChanged ? "bg-[#6FF2B0]/70" : "bg-transparent")} />
                )}
                {focused && <span aria-hidden="true" className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#7F8CFF]" />}
                <span className={cx("flex-none text-right select-none", lights ? "text-parchment-dim" : "text-ink-4")} style={{ width: `${Math.max(2, gutter)}ch` }}>
                  {n}
                </span>
                <code
                  className={cx("flex-auto whitespace-pre", dim.has(n) && "line-through decoration-[#8FAE78]/60 opacity-45")}
                  style={deco && !dim.has(n) ? { textDecoration: `underline wavy ${deco}`, textUnderlineOffset: 7, textDecorationThickness: 1.5 } : undefined}
                >
                  {text === "" ? " " : tokenize(text, file.language).map((t, k) => (t.type === "plain" ? <span key={k}>{t.text}</span> : <span key={k} className={`tok-${t.type}`}>{t.text}</span>))}
                </code>
                {monsters && (
                  <span className="sticky left-4 flex flex-none basis-full flex-wrap gap-2 sm:right-4 sm:left-auto sm:basis-auto pl-[var(--gutter-pad)] sm:pl-0" style={{ "--gutter-pad": `calc(${Math.max(2, gutter)}ch + 1rem)` } as CSSProperties}>
                    {monsters.map((f) => (
                      <MonsterChip
                        key={f.id}
                        finding={f}
                        line={n}
                        selected={f.id === selectedId}
                        banishing={f.id === banishingId}
                        lights={lights}
                        delay={(i * 0.37) % 3}
                        onPick={() => onPick(f.id)}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
