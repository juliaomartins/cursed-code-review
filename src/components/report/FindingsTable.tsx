"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MONSTERS } from "@/lib/monsters";
import { statusLabel } from "@/lib/report";
import { primaryLine } from "@/lib/review/apply";
import { byPriority, priority, SEVERITY_LABEL } from "@/lib/review/priority";
import { findingMeta } from "@/lib/scanner/rules";
import type { Category, Finding, ReviewFile, Severity } from "@/lib/types";
import { Monster } from "../Monster";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { SeverityBadge } from "../ui/SeverityBadge";

type Item = { f: Finding; file: ReviewFile; path: string };
type StatusFilter = "all" | "open" | "fixed" | "dismissed";

const statusCls = (f: Finding) =>
  f.status === "banished"
    ? f.verification === "still-detected"
      ? "bg-sev-med/[0.14] text-warn-ink"
      : "bg-banished/[0.12] text-banished"
    : f.status === "ignored"
      ? "bg-chip text-ink-2"
      : "bg-ember/[0.14] text-ember-soft";

/** The five findings to fix first, with why they rank high. */
export function FixFirst({ items, onOpen }: { items: Item[]; onOpen: (fileId: string, findingId: string) => void }) {
  const open = byPriority(items.filter((x) => x.f.status === "lurking")).slice(0, 5);
  if (!open.length) return null;
  return (
    <section aria-labelledby="fix-first" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="fix-first" className="m-0 font-display text-[34px] leading-none font-bold">
          Fix first
        </h2>
        <p className="m-0 text-sm text-ink-3">
          Ranked by severity, the rule&apos;s confidence, and whether untrusted input was seen reaching the code. Nothing here is guessed.
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {open.map(({ f, file }, i) => {
          const m = findingMeta(f);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onOpen(file.id, f.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-card px-4 py-3 text-left hover:border-ember/50"
              >
                <span aria-hidden="true" className={cx("w-6 font-display text-2xl font-bold", i === 0 ? "text-ember" : "text-ink-4")}>
                  {i + 1}
                </span>
                <SeverityBadge severity={f.severity} />
                <span className="font-medium text-ink">{m.rule.title}</span>
                <span className="font-mono text-[13px] text-ink-3">
                  {file.path}:{primaryLine(f)}
                  {f.column ? `:${f.column}` : ""}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  {f.exposure && <span className="rounded-full bg-sev-high/[0.12] px-2 py-0.5 text-sev-high">untrusted input</span>}
                  <span>confidence {m.confidence}</span>
                  <span className="font-mono">P{priority(f)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Every finding, filterable and searchable, with the rule, exact location and verified status. */
export function FindingsTable({ items, multi, onOpen }: { items: Item[]; multi: boolean; onOpen: (fileId: string, findingId: string) => void }) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"file" | "priority">("file");

  const categories = useMemo(() => Array.from(new Set(items.map((x) => findingMeta(x.f).category))), [items]);
  const severities = (["CRITICAL", "HIGH", "MED", "LOW"] as Severity[]).filter((s) => items.some((x) => x.f.severity === s));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(({ f, path }) => {
      const m = findingMeta(f);
      if (severity !== "all" && f.severity !== severity) return false;
      if (category !== "all" && m.category !== category) return false;
      if (status === "open" && f.status !== "lurking") return false;
      if (status === "fixed" && f.status !== "banished") return false;
      if (status === "dismissed" && f.status !== "ignored") return false;
      if (q && ![path, m.ruleId, m.rule.title, f.bug, f.why, MONSTERS[f.kind].name].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
    return sort === "priority" ? byPriority(list) : list;
  }, [items, severity, category, status, query, sort]);

  const select = "min-h-11 rounded-xl border border-line-strong bg-well px-3 text-sm text-ink";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter findings">
        <label className="relative flex min-w-[200px] flex-1 items-center">
          <span className="sr-only">Search findings</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 text-ink-4" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search file, rule or text…"
            className="min-h-11 w-full rounded-xl border border-line-strong bg-well pr-3 pl-9 text-sm text-ink outline-none focus:border-ember"
          />
        </label>
        <label>
          <span className="sr-only">Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "all")} className={select}>
            <option value="all">All severities</option>
            {severities.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "all")} className={select}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={select}>
            <option value="all">Any status</option>
            <option value="open">Open</option>
            <option value="fixed">Fixed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "file" | "priority")} className={select}>
            <option value="file">By file and line</option>
            <option value="priority">By priority</option>
          </select>
        </label>
      </div>
      <p className="m-0 text-sm text-ink-3" aria-live="polite">
        Showing {shown.length} of {items.length} finding{items.length === 1 ? "" : "s"}.
      </p>
      <div className="scrollbar-thin relative overflow-x-auto rounded-2xl border border-line bg-card">
        <table aria-labelledby="found" className="w-full min-w-[820px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left font-mono text-xs tracking-[0.12em] text-ink-3">
              <th scope="col" className="px-[18px] py-3.5 font-medium">
                MONSTER
              </th>
              {multi && (
                <th scope="col" className="px-[18px] py-3.5 font-medium">
                  FILE
                </th>
              )}
              <th scope="col" className="px-[18px] py-3.5 font-medium">
                LINE
              </th>
              <th scope="col" className="px-[18px] py-3.5 font-medium">
                BUG
              </th>
              <th scope="col" className="px-[18px] py-3.5 font-medium">
                SEVERITY
              </th>
              <th scope="col" className="px-[18px] py-3.5 font-medium">
                STATUS
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ f, file }) => {
              const m = findingMeta(f);
              return (
                <tr key={f.id} className="border-t border-line">
                  <td className="px-[18px] py-2.5">
                    <span className="flex items-center gap-3">
                      <Monster kind={f.kind} size={36} glow={false} />
                      <strong>{MONSTERS[f.kind].name}</strong>
                    </span>
                  </td>
                  {multi && <td className="px-[18px] py-2.5 font-mono text-[13px] text-ink-2">{file.path.split("/").pop()}</td>}
                  <td className="px-[18px] py-2.5 font-mono">
                    <Link href="/crypt" onClick={() => onOpen(file.id, f.id)} className="no-underline hover:underline">
                      {primaryLine(f)}
                      {f.column ? <span className="text-ink-4">:{f.column}</span> : null}
                    </Link>
                  </td>
                  <td className="px-[18px] py-2.5 text-ink-2">
                    <span className="flex flex-col">
                      <span>{f.bug}</span>
                      <span className="font-mono text-[11.5px] text-ink-4">
                        {m.ruleId} · {m.category} · {m.confidence}
                      </span>
                    </span>
                  </td>
                  <td className="px-[18px] py-2.5">
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td className="px-[18px] py-2.5">
                    <span className={cx("rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", statusCls(f))}>{statusLabel(f)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
