"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MONSTER_ORDER, MONSTERS } from "@/lib/monsters";
import { fileStats } from "@/lib/review/selectors";
import type { Review } from "@/lib/types";
import { Monster } from "../Monster";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";

const SCAN_KIND = { file: "FILE", folder: "FOLDER", repo: "REPOSITORY", commit: "COMMIT", compare: "BRANCH COMPARISON" } as const;

/** Shortest path suffix that tells files apart: "route.ts" → "pr/route.ts" when names repeat. */
export function displayNames(paths: string[]): string[] {
  const parts = paths.map((p) => p.split("/"));
  return parts.map((segs, i) => {
    for (let n = 1; n <= segs.length; n++) {
      const name = segs.slice(-n).join("/");
      if (parts.every((other, j) => j === i || other.slice(-n).join("/") !== name)) return name;
    }
    return paths[i];
  });
}

export function FileNav({ review, onSelect }: { review: Review; onSelect: (id: string) => void }) {
  const src = review.source;
  const names = displayNames(review.files.map((f) => f.path));
  const [legendOpen, setLegendOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the legend by default on wide screens only
    setLegendOpen(window.matchMedia?.("(min-width: 1024px)").matches ?? true);
  }, []);
  return (
    <nav aria-label="Files and bestiary" className="flex flex-col gap-2.5">
      {src.kind === "pr" && (
        <div className="mb-3 flex flex-col gap-1.5 rounded-xl border border-line bg-card p-3">
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-ink-3">
            <Icon name="pr" size={14} /> PULL REQUEST
          </span>
          <a href={src.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-ink no-underline hover:text-ember-pale">
            {src.title}
          </a>
          <span className="font-mono text-xs text-ink-3">
            {src.label} · @{src.author}
          </span>
          <span className="font-mono text-[11px] text-ink-4">
            {src.headRef} → {src.baseRef}
          </span>
          {!!src.skippedFiles && (
            <span className="text-xs text-ink-3">
              {src.skippedFiles} changed file{src.skippedFiles === 1 ? "" : "s"} not scanned (other languages, deleted, or over the 15-file limit).
            </span>
          )}
        </div>
      )}
      {src.kind === "github" && (
        <div className="mb-3 flex flex-col gap-1.5 rounded-xl border border-line bg-card p-3">
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-ink-3">
            <Icon name="github" size={14} /> {SCAN_KIND[src.target]}
          </span>
          <a href={src.url} target="_blank" rel="noreferrer" className="text-sm font-bold break-words text-ink no-underline hover:text-ember-pale">
            {src.title}
          </a>
          <span className="font-mono text-[11px] text-ink-4">
            {src.owner}/{src.repo} @ {src.ref.length > 20 ? src.sha.slice(0, 7) : src.ref}
          </span>
          {!!src.skippedFiles && (
            <span className="text-xs text-ink-3">
              {src.skippedFiles} file{src.skippedFiles === 1 ? "" : "s"} not scanned (other languages, generated, too big
              {src.truncated ? ", or over the limit" : ""}).
            </span>
          )}
        </div>
      )}
      {review.files.length > 1 && (
        <Link href="/map" className="mb-2 inline-flex min-h-10 items-center gap-2 self-start rounded-lg px-1 text-sm font-medium no-underline">
          <Icon name="search" size={16} /> Haunted Map
        </Link>
      )}
      <p className="m-0 mb-1 font-mono text-[11px] tracking-[0.16em] text-ink-3">FILES</p>
      <ul className="m-0 flex list-none gap-2.5 relative overflow-x-auto p-0 pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {review.files.map((f, i) => {
          const s = fileStats(f);
          const active = f.id === review.activeFileId;
          return (
            <li key={f.id} className="flex-none lg:flex-auto">
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                aria-current={active ? "page" : undefined}
                title={f.path}
                className={cx(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border px-3 text-left font-mono text-[13px] transition-colors",
                  active ? "border-ember bg-ember/[0.08] text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                <span className="truncate" dir="rtl">
                  <bdi>{names[i]}</bdi>
                </span>
                <span
                  className={cx(
                    "min-w-6 rounded-full px-2 py-0.5 text-center",
                    s.lurking === 0 ? "bg-banished/[0.14] text-banished" : active ? "bg-ember font-bold text-ember-ink" : "bg-chip text-ink-2",
                  )}
                  aria-label={s.lurking === 0 ? "clear" : `${s.lurking} lurking`}
                >
                  {s.lurking === 0 ? <Icon name="check" size={12} strokeWidth={3} className="inline" /> : s.lurking}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <details className="group mt-4 lg:mt-[22px]" open={legendOpen} onToggle={(e) => setLegendOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-mono text-[11px] tracking-[0.16em] text-ink-3 [&::-webkit-details-marker]:hidden">
          BESTIARY
          <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <ul className="m-0 mt-1 grid list-none grid-cols-2 gap-x-3 p-0 sm:grid-cols-3 lg:grid-cols-1">
          {MONSTER_ORDER.map((k) => (
            <li key={k} className="flex min-h-10 items-center gap-2.5">
              <Monster kind={k} size={32} glow={false} />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold">{MONSTERS[k].name}</span>
                <span className="text-xs text-ink-3">{MONSTERS[k].bug}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
