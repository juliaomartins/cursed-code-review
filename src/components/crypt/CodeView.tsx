"use client";

import { useMemo, useRef, type CSSProperties, type MouseEvent } from "react";
import { tokenize } from "@/lib/highlight";
import { emergeDelay } from "@/lib/horror";
import { SEVERITY } from "@/lib/monsters";
import { findingLines, primaryLine } from "@/lib/review/apply";
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
  /** Length of the banishment now playing, in ms. */
  banishMs?: number;
  /** A finding whose fix just failed to apply. */
  resistingId?: string | null;
}

export function CodeView({ file, selectedId, banishingId, lights, onPick, banishMs, resistingId = null }: CodeViewProps) {
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

  // Monsters climb out of the code in reading order.
  const emergeOrder = useMemo(() => {
    const order = new Map<string, number>();
    file.findings
      .filter((f) => f.status === "lurking" && !f.stale)
      .sort((a, b) => primaryLine(a) - primaryLine(b))
      .forEach((f, i) => order.set(f.id, i));
    return order;
  }, [file.findings]);

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
        "codex-frame overflow-hidden rounded-xl border font-mono text-sm shadow-[0_30px_60px_rgba(0,0,0,0.5)]",
        lights ? "lights-on border-parchment-line bg-parchment text-parchment-ink" : "border-line text-[#E4DCCB]",
      )}
    >
      <div
        className={cx(
          "flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-xs",
          lights ? "border-parchment-line text-parchment-dim" : "border-line text-ink-4",
        )}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-crimson" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#9CBF69]" />
        <span className="ml-2 min-w-0 truncate">{file.path}</span>
        <span className="ml-auto flex items-center gap-3">
          {changed && <span className="rounded-full bg-[#9CBF69]/15 px-2 py-0.5 text-[#B9D58E]">{changed.size} changed lines</span>}
          {file.focusLines && (
            <span className="rounded-full bg-[#8AC7D1]/15 px-2 py-0.5 text-[#A9D6DD]">
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
        // A horizontally scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="scrollbar-thin relative overflow-x-auto pt-2.5 pb-3.5"
        style={
          lights
            ? undefined
            : {
                background: "radial-gradient(circle 260px at var(--lx, 320px) var(--ly, 220px), rgba(232,145,63,0.13), rgba(232,145,63,0) 72%), #0E0F14",
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
                  focused && !isSel && (lights ? "bg-[#f3eee6]" : "bg-[#8AC7D1]/[0.07]"),
                  changed && !isChanged && !monsters && "opacity-60",
                )}
              >
                {changed && (
                  <span aria-hidden="true" className={cx("absolute top-0 bottom-0 left-0 w-[3px]", isChanged ? "bg-[#9CBF69]/70" : "bg-transparent")} />
                )}
                {focused && <span aria-hidden="true" className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#8AC7D1]" />}
                {monsters && (
                  <span
                    key={`${file.id}:${monsters[0].id}`}
                    aria-hidden="true"
                    className="line-summon"
                    style={{ "--ed": `${emergeDelay(emergeOrder.get(monsters[0].id) ?? 0)}s`, "--sc": deco } as CSSProperties}
                  />
                )}
                <span
                  className={cx("flex-none text-right select-none", lights ? "text-parchment-dim" : "text-ink-4")}
                  style={{ width: `${Math.max(2, gutter)}ch` }}
                >
                  {n}
                </span>
                <code
                  className={cx("flex-auto whitespace-pre", dim.has(n) && "line-through decoration-[#8FAE78]/60 opacity-45")}
                  style={deco && !dim.has(n) ? { textDecoration: `underline wavy ${deco}`, textUnderlineOffset: 7, textDecorationThickness: 1.5 } : undefined}
                >
                  {text === ""
                    ? " "
                    : tokenize(text, file.language).map((t, k) =>
                        t.type === "plain" ? (
                          <span key={k}>{t.text}</span>
                        ) : (
                          <span key={k} className={`tok-${t.type}`}>
                            {t.text}
                          </span>
                        ),
                      )}
                </code>
                {monsters && (
                  <span
                    className="sticky left-4 flex flex-none basis-full flex-wrap gap-2 sm:right-4 sm:left-auto sm:basis-auto pl-[var(--gutter-pad)] sm:pl-0"
                    style={{ "--gutter-pad": `calc(${Math.max(2, gutter)}ch + 1rem)` } as CSSProperties}
                  >
                    {monsters.map((f) => (
                      <MonsterChip
                        key={f.id}
                        finding={f}
                        line={n}
                        selected={f.id === selectedId}
                        banishing={f.id === banishingId}
                        lights={lights}
                        delay={(i * 0.37) % 3}
                        emergeAfter={emergeDelay(emergeOrder.get(f.id) ?? 0)}
                        banishMs={banishMs}
                        resisting={f.id === resistingId}
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
