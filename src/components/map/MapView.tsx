"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useReview } from "@/providers/ReviewProvider";
import { GitHubError } from "@/lib/github";
import { scanLinkLive } from "@/lib/githubLive";
import { MONSTER_ORDER, MONSTERS, SEVERITY } from "@/lib/monsters";
import { reviewFromScan } from "@/lib/review/factory";
import { fileStats, lurkingOf, reviewStats, worstSeverity } from "@/lib/review/selectors";
import type { MonsterKind, ReviewFile, Severity } from "@/lib/types";
import { useSummon } from "../home/useSummon";
import { Logo } from "../layout/Logo";
import { Monster } from "../Monster";
import { Lantern } from "../crypt/RoomLight";
import { Button, ButtonLink } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { SeverityBadge } from "../ui/SeverityBadge";

type View = "haunted" | "folders";

const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const nameOf = (path: string) => path.split("/").pop() ?? path;

/** Files ordered by how haunted they are: lurking HIGH first, then MED, LOW, then by count. */
export function hauntedOrder(files: ReviewFile[]): ReviewFile[] {
  const score = (f: ReviewFile) => {
    const l = lurkingOf(f);
    return l.reduce((n, x) => n + SEVERITY[x.severity].rank * 100, 0) + l.length;
  };
  return [...files].sort((a, b) => score(b) - score(a) || a.path.localeCompare(b.path));
}

export function MapView() {
  const { review, hydrated, dispatch } = useReview();
  const router = useRouter();
  const { summon, overlay, busy } = useSummon();
  const [view, setView] = useState<View>("haunted");
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!review) return null;
    const all = review.files.flatMap((f) => f.findings);
    const lurking = all.filter((f) => f.status === "lurking");
    const byKind = new Map<MonsterKind, number>();
    const bySev = new Map<Severity, number>();
    for (const f of lurking) {
      byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
      bySev.set(f.severity, (bySev.get(f.severity) ?? 0) + 1);
    }
    const ordered = hauntedOrder(review.files);
    const haunted = ordered.filter((f) => lurkingOf(f).length > 0);
    const clear = ordered.filter((f) => lurkingOf(f).length === 0);
    const folders = new Map<string, ReviewFile[]>();
    for (const f of [...review.files].sort((a, b) => a.path.localeCompare(b.path))) folders.set(dirOf(f.path), [...(folders.get(dirOf(f.path)) ?? []), f]);
    return { stats: reviewStats(review), worst: worstSeverity(lurking), byKind, bySev, haunted, clear, folders };
  }, [review]);

  if (!hydrated) return <div className="skeleton m-8 h-[70vh] rounded-2xl" aria-busy="true" aria-label="Drawing the map" />;
  if (!review || !data) return <NoMap />;

  const src = review.source;
  const open = (file: ReviewFile) => {
    dispatch({ type: "selectFile", fileId: file.id });
    router.push("/crypt");
  };
  const scanFolder = async (folder: string) => {
    if (src.kind !== "github") return;
    setError(null);
    const url = `https://github.com/${src.owner}/${src.repo}/tree/${src.ref}/${folder}`;
    try {
      const res = await scanLinkLive(url);
      if (res.target === "pr") return;
      summon("Mapping the crypt", () => reviewFromScan(res), [`Fetched ${res.files.length} files from ${folder}`, "Running 7 static checks on every line", "Drawing the Haunted Map"], () => "/map");
    } catch (e) {
      setError(e instanceof GitHubError ? e.message : "Couldn't reach GitHub. Try again.");
    }
  };
  const first = data.haunted[0];

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_1100px_520px_at_70%_-5%,rgba(127,140,255,0.12),rgba(127,140,255,0)_70%),#0D0A12]">
      <header className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-7">
        <Logo size={38} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/report" variant="ghost">
            Report
          </ButtonLink>
          <ButtonLink href="/crypt" variant="outline">
            Open the crypt
            <Icon name="arrowRight" size={16} />
          </ButtonLink>
        </div>
      </header>

      <main id="main" className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-4 pt-6 pb-20 sm:px-7">
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
            <span className="font-mono text-xs tracking-[0.14em] break-words text-ink-3">HAUNTED MAP · {src.label}</span>
            <h1 className="m-0 font-display text-[56px] leading-[0.95] font-bold sm:text-[76px]">
              {data.stats.lurking === 0 ? "Not a single monster." : data.stats.lurking === 1 ? "1 monster roams here." : `${data.stats.lurking} monsters roam here.`}
            </h1>
            <p className="m-0 text-[16px] text-ink-2">
              {review.files.length} files scanned · {data.haunted.length} haunted · {data.clear.length} clear
              {src.kind === "github" && src.skippedFiles ? ` · ${src.skippedFiles} skipped (other languages, generated or too big)` : ""}
            </p>
            {src.kind === "github" && (
              <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm">
                {src.title} <Icon name="external" size={14} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-3.5">
            <Lantern />
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">ROOM LIGHT · {data.stats.light}%</span>
              <div role="progressbar" aria-label="Room light" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.stats.light} className="h-2 w-[220px] overflow-hidden rounded-full bg-track">
                <div className="h-full bg-gradient-to-r from-ember to-ember-gold shadow-[0_0_12px_#FF8A3D]" style={{ width: `${data.stats.light}%` }} />
              </div>
            </div>
          </div>
        </section>

        {src.kind === "github" && src.truncated && (
          <section className="flex flex-col gap-3 rounded-2xl border border-sev-med/40 bg-sev-med/[0.06] p-5">
            <p className="m-0 text-[15px] text-[#ffe0ad]">
              This repository has {src.truncated.total} files the crypt can read. It scanned the first {src.truncated.scanned}, source code first. Pick a folder to scan it fully:
            </p>
            <div className="flex flex-wrap gap-2">
              {src.truncated.folders
                .filter((f) => f.path !== "(root)")
                .map((f) => (
                  <Button key={f.path} size="sm" variant="outline" disabled={busy} onClick={() => scanFolder(f.path)}>
                    {f.path}/ <span className="text-ink-3">{f.count}</span>
                  </Button>
                ))}
            </div>
            {error && (
              <p role="alert" className="m-0 text-sm text-sev-high">
                {error}
              </p>
            )}
          </section>
        )}

        <section aria-label="Monsters by type" className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-3">
          {MONSTER_ORDER.map((k) => {
            const n = data.byKind.get(k) ?? 0;
            return (
              <div key={k} className={cx("flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5", !n && "opacity-40")}>
                <Monster kind={k} size={44} glow={n > 0} />
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-3xl font-bold">{n}</span>
                  <span className="text-xs text-ink-3">{MONSTERS[k].name}</span>
                </span>
              </div>
            );
          })}
          <div className="flex flex-col justify-center gap-1.5 rounded-2xl border border-line bg-card p-3.5">
            {(["HIGH", "MED", "LOW"] as Severity[]).map((s) => (
              <span key={s} className="flex items-center justify-between gap-2 text-sm">
                <SeverityBadge severity={s} />
                <span className="font-mono">{data.bySev.get(s) ?? 0}</span>
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="files-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="files-title" className="m-0 font-display text-[40px] font-bold">
              The rooms
            </h2>
            <div role="group" aria-label="Sort files" className="flex gap-1.5 rounded-xl bg-well p-1">
              {(
                [
                  ["haunted", "Most haunted"],
                  ["folders", "By folder"],
                ] as [View, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cx("min-h-10 rounded-[9px] px-4 text-sm font-medium", view === v ? "bg-line-strong text-ink" : "text-ink-2 hover:bg-white/[0.04]")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {view === "haunted" ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.haunted.map((f) => (
                <FileRow key={f.id} file={f} onOpen={() => open(f)} showDir />
              ))}
              {data.clear.length > 0 && (
                <li>
                  <details className="rounded-2xl border border-line bg-card/60">
                    <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm text-ink-2">
                      <Icon name="check" size={16} className="text-banished" /> {data.clear.length} clear file{data.clear.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="m-0 flex list-none flex-col gap-1 p-2 pt-0">
                      {data.clear.map((f) => (
                        <FileRow key={f.id} file={f} onOpen={() => open(f)} showDir compact />
                      ))}
                    </ul>
                  </details>
                </li>
              )}
            </ul>
          ) : (
            <div className="flex flex-col gap-4">
              {[...data.folders.entries()].map(([dir, files]) => (
                <div key={dir || "(root)"} className="flex flex-col gap-2">
                  <h3 className="m-0 flex items-center gap-2 font-mono text-[13px] font-normal text-ink-3">
                    <Icon name="file" size={14} /> {dir || "(root)"}/
                  </h3>
                  <ul className="m-0 flex list-none flex-col gap-2 border-l border-line p-0 pl-3">
                    {files.map((f) => (
                      <FileRow key={f.id} file={f} onOpen={() => open(f)} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {first ? (
            <Button variant="primary" size="lg" onClick={() => open(first)} className="py-3 text-left whitespace-normal!">
              Enter the crypt: start with {nameOf(first.path)}
              <Icon name="arrowRight" />
            </Button>
          ) : (
            <ButtonLink href="/report" variant="primary" size="lg">
              See the report
            </ButtonLink>
          )}
          <ButtonLink href="/#start" variant="outline" size="lg">
            Scan something else
          </ButtonLink>
        </div>
      </main>
      {overlay}
    </div>
  );
}

function FileRow({ file, onOpen, showDir = false, compact = false }: { file: ReviewFile; onOpen: () => void; showDir?: boolean; compact?: boolean }) {
  const s = fileStats(file);
  const lurking = lurkingOf(file);
  const kinds = Array.from(new Set(lurking.map((f) => f.kind)));
  const worst = worstSeverity(lurking);
  const dir = dirOf(file.path);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${file.path}: ${s.lurking ? `${s.lurking} monsters lurking` : "clear"}`}
        className={cx(
          "flex w-full items-center gap-3 rounded-2xl border text-left transition-colors hover:border-line-strong",
          compact ? "min-h-11 border-transparent px-3 py-1.5" : "min-h-16 border-line bg-card px-4 py-3",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-sm text-ink">{nameOf(file.path)}</span>
          {showDir && dir && <span className="truncate font-mono text-xs text-ink-4">{dir}/</span>}
        </span>
        {s.lurking > 0 ? (
          <>
            <span className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
              {kinds.slice(0, 4).map((k) => (
                <Monster key={k} kind={k} size={28} glow={false} />
              ))}
              {kinds.length > 4 && <span className="ml-1 text-xs text-ink-3">+{kinds.length - 4}</span>}
            </span>
            {worst && <SeverityBadge severity={worst} />}
            <span className="min-w-8 rounded-full bg-ember px-2 py-0.5 text-center font-mono text-sm font-bold text-ember-ink">{s.lurking}</span>
          </>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-banished/[0.12] px-2.5 py-0.5 text-xs text-banished">
            <Icon name="check" size={12} strokeWidth={3} /> {s.total ? "cleared" : "clear"}
          </span>
        )}
      </button>
    </li>
  );
}

function NoMap() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <Monster kind="wraith" size={120} />
      <h1 className="m-0 font-display text-5xl leading-none">No map to draw yet.</h1>
      <p className="m-0 max-w-md text-ink-2">Bring a GitHub repository or folder link, and the Haunted Map shows where every monster hides.</p>
      <ButtonLink href="/#start" variant="primary" size="lg">
        Bring a GitHub link
      </ButtonLink>
    </div>
  );
}
