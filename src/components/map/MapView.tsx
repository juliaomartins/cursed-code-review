"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useReview } from "@/providers/ReviewProvider";
import { GitHubError } from "@/lib/github";
import { scanLinkLive } from "@/lib/githubLive";
import { readExplored, recordExplored, repoKey, scannedFolder, type ExploredRepo } from "@/lib/explored";
import { buildTree, defaultOpen, filterTree, folderPaths, type TreeFile } from "@/lib/fileTree";
import { MONSTER_ORDER, MONSTERS, SEVERITY } from "@/lib/monsters";
import { reviewFromScan } from "@/lib/review/factory";
import { fileStats, lurkingOf, reviewStats, worstSeverity } from "@/lib/review/selectors";
import type { MonsterKind, ReviewFile, Severity } from "@/lib/types";
import { useSummon } from "../home/useSummon";
import { Logo } from "../layout/Logo";
import { LivingMonster } from "../LivingMonster";
import { Monster } from "../Monster";
import { Button, ButtonLink } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { SeverityBadge } from "../ui/SeverityBadge";
import { Crypts } from "./Crypts";
import { FileTree } from "./FileTree";
import { MapSky } from "./MapSky";
import { PumpkinGauge } from "./PumpkinGauge";

type View = "tree" | "ranked";
type Show = "all" | "haunted" | "clear";

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
  const [view, setView] = useState<View>("tree");
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MonsterKind | null>(null);
  const [openState, setOpenState] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explored, setExplored] = useState<ExploredRepo | null>(null);
  const [now, setNow] = useState(0);

  // A new scan (e.g. a folder opened from this map) starts with a fresh view: no leftover filters or folds.
  const [shownId, setShownId] = useState(review?.id);
  if (review && review.id !== shownId) {
    setShownId(review.id);
    setOpenState(null);
    setKind(null);
    setQuery("");
    setShow("all");
    setError(null);
  }

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
    const tree = buildTree(review.files);
    return { stats: reviewStats(review), worst: worstSeverity(lurking), byKind, bySev, haunted, clear, tree, found: all.length };
  }, [review]);

  // Remember this folder (or the whole repository) as explored, and read what else was explored before.
  const src = review?.source;
  const ghKey = src?.kind === "github" && scannedFolder(src) !== null ? repoKey(src) : null;
  useEffect(() => {
    if (!review || review.source.kind !== "github" || !ghKey || !data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage after mount
    setExplored(recordExplored(review.source, review.files.length, data.found) ?? readExplored(ghKey));
    setNow(Date.now());
  }, [ghKey, review, data]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    const keep = (f: TreeFile) =>
      (!q || f.file.path.toLowerCase().includes(q)) &&
      (show === "all" || (show === "haunted" ? f.lurking > 0 : f.lurking === 0)) &&
      (!kind || f.kinds.includes(kind));
    const tree = filterTree(data.tree, keep);
    const keepFile = (file: ReviewFile) => {
      const l = lurkingOf(file);
      return keep({ type: "file", name: file.path, file, lurking: l.length, worst: null, kinds: l.map((x) => x.kind) });
    };
    return { tree, haunted: data.haunted.filter(keepFile), clear: data.clear.filter(keepFile) };
  }, [data, query, show, kind]);

  if (!hydrated) return <div className="skeleton m-8 h-[70vh] rounded-2xl" aria-busy="true" aria-label="Drawing the map" />;
  if (!review || !data || !filtered || !src) return <NoMap />;

  const filtering = !!query.trim() || show !== "all" || !!kind;
  const open = filtering && filtered.tree ? new Set(folderPaths(filtered.tree)) : (openState ?? defaultOpen(data.tree));
  const toggle = (path: string) => {
    const next = new Set(open);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setOpenState(next);
  };
  const allFolders = folderPaths(data.tree);

  const openFile = (file: ReviewFile) => {
    dispatch({ type: "selectFile", fileId: file.id });
    router.push("/crypt");
  };
  const scanFolder = async (folder: string) => {
    if (src.kind !== "github") return;
    setError(null);
    const url = folder
      ? `https://github.com/${src.owner}/${src.repo}/tree/${src.ref}/${folder}`
      : `https://github.com/${src.owner}/${src.repo}/tree/${src.ref}`;
    try {
      const res = await scanLinkLive(url);
      if (res.target === "pr") return;
      summon(
        "Mapping the crypt",
        () => reviewFromScan(res),
        [
          `Fetched ${res.files.length} files from ${folder ? `${folder}/` : "the repository"}`,
          "Running 7 static checks on every line",
          "Drawing the Haunted Map",
        ],
        () => "/map",
      );
    } catch (e) {
      setError(e instanceof GitHubError ? e.message : "Couldn't reach GitHub. Try again.");
    }
  };

  const gh = src.kind === "github" ? src : null;
  const current = gh ? scannedFolder(gh) : null;
  const folders = gh?.truncated?.folders ?? explored?.folders ?? [];
  const first = data.haunted[0];
  const lurking = data.stats.lurking;

  return (
    <div className="map-root relative flex min-h-screen flex-col overflow-x-clip">
      <MapSky />
      <header className="relative z-10 mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-7">
        <Logo size={38} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/report" variant="ghost">
            Report
          </ButtonLink>
          <ButtonLink href="/crypt" variant="outline" className="map-glass">
            Open the crypt
            <Icon name="arrowRight" size={16} />
          </ButtonLink>
        </div>
      </header>

      <main id="main" className="relative z-10 mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-4 pt-6 pb-20 sm:px-7">
        <section className="flex flex-wrap items-center justify-between gap-8">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-4">
            <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-3">
              <span>HAUNTED MAP</span>
              <span aria-hidden="true">·</span>
              {gh ? (
                <>
                  {current ? (
                    <button
                      type="button"
                      onClick={() => scanFolder("")}
                      disabled={busy}
                      className="min-h-8 rounded-md break-all text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink"
                      title="Back to the whole repository"
                    >
                      {gh.owner}/{gh.repo}
                    </button>
                  ) : (
                    <span className="break-all text-ink-2">
                      {gh.owner}/{gh.repo}
                    </span>
                  )}
                  {current ? (
                    <>
                      <span aria-hidden="true">›</span>
                      <span className="break-all text-ember-soft">{current}/</span>
                    </>
                  ) : null}
                  <span className="rounded-full border border-line-strong px-2 py-0.5 text-[10px] tracking-normal text-ink-3">{gh.ref}</span>
                </>
              ) : (
                <span className="break-words">{src.label}</span>
              )}
            </nav>
            {current ? (
              <Button size="sm" variant="outline" onClick={() => scanFolder("")} disabled={busy} className="map-glass self-start">
                <Icon name="arrowLeft" size={16} />
                Whole repository
              </Button>
            ) : null}
            <h1 className="m-0 font-brand text-[52px] leading-[0.95] font-bold sm:text-[76px] [text-shadow:0_0_40px_rgba(138,199,209,0.18)]">
              {lurking === 0 ? "Not a single monster." : lurking === 1 ? "1 monster roams here." : `${lurking} monsters roam here.`}
            </h1>
            {gh && (
              <a href={gh.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm">
                {gh.title} <Icon name="external" size={14} />
              </a>
            )}
            <dl className="m-0 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="files scanned" value={review.files.length} icon={<Icon name="file" size={16} />} />
              <Stat label="haunted" value={data.haunted.length} icon={<Icon name="flame" size={16} />} tone={data.haunted.length ? "ember" : undefined} />
              <Stat label="clear" value={data.clear.length} icon={<Icon name="check" size={16} strokeWidth={2.6} />} tone="banished" />
              {gh?.skippedFiles ? (
                <Stat label="skipped" value={gh.skippedFiles} icon={<Icon name="eyeOff" size={16} />} hint="Other languages, generated or too big" />
              ) : null}
            </dl>
          </div>
          <PumpkinGauge light={data.stats.light} lurking={lurking} />
        </section>

        {error && !(gh && folders.length > 0 && current !== null) && (
          <p role="alert" className="m-0 text-sm text-sev-high">
            {error}
          </p>
        )}

        {gh && folders.length > 0 && current !== null && (
          <Crypts
            folders={folders}
            total={gh.truncated?.total ?? explored?.total}
            scanned={gh.truncated?.scanned ?? explored?.scanned}
            scans={explored?.scans ?? {}}
            current={current}
            busy={busy}
            error={error}
            onScan={scanFolder}
            now={now}
          />
        )}

        <section aria-labelledby="census-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="census-title" className="m-0 font-display text-[34px] leading-none font-bold">
              Monster census
            </h2>
            <span className="text-sm text-ink-3">{lurking ? "Tap a monster to see only the rooms it haunts." : "Every room is quiet."}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(132px,100%),1fr))] gap-3">
            {MONSTER_ORDER.map((k) => {
              const n = data.byKind.get(k) ?? 0;
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  disabled={!n}
                  onClick={() => setKind(on ? null : k)}
                  aria-label={`${MONSTERS[k].name}: ${n}`}
                  className={cx(
                    "map-glass flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-[border-color,box-shadow,transform] duration-200",
                    on ? "border-ember shadow-[0_0_24px_rgba(201,168,106,0.3)]" : "border-line enabled:hover:-translate-y-0.5 enabled:hover:border-line-strong",
                    !n && "opacity-40",
                  )}
                >
                  <LivingMonster kind={k} size={44} glow={n > 0} reach={140} />
                  <span className="flex flex-col leading-tight">
                    <span className="font-display text-3xl font-bold">{n}</span>
                    <span className="text-xs text-ink-3">{MONSTERS[k].name}</span>
                  </span>
                </button>
              );
            })}
            <div className="map-glass flex flex-col justify-center gap-2 rounded-2xl border border-line p-3.5">
              <SeverityBar bySev={data.bySev} total={lurking} />
            </div>
          </div>
        </section>

        <section aria-labelledby="files-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="files-title" className="m-0 font-display text-[40px] leading-none font-bold">
              The rooms
            </h2>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                ["tree", "Folder tree"],
                ["ranked", "Most haunted"],
              ]}
            />
          </div>

          <div className="codex-frame map-glass flex flex-col gap-3 rounded-3xl border border-line p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex min-w-[200px] flex-1 items-center">
                <span className="sr-only">Search files</span>
                <Icon name="search" size={16} className="pointer-events-none absolute left-3 text-ink-4" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search files…"
                  className="min-h-11 w-full rounded-xl border border-line-strong bg-well pr-3 pl-9 font-mono text-sm text-ink outline-none focus:border-ember"
                />
              </label>
              <Segmented
                label="Show"
                value={show}
                onChange={setShow}
                options={[
                  ["all", "All"],
                  ["haunted", `Haunted ${data.haunted.length}`],
                  ["clear", `Clear ${data.clear.length}`],
                ]}
              />
              {view === "tree" && allFolders.length > 0 && !filtering && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setOpenState(new Set(allFolders))}>
                    Expand all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenState(new Set())}>
                    Collapse all
                  </Button>
                </div>
              )}
            </div>
            {kind && (
              <p className="m-0 flex items-center gap-2 text-sm text-ink-2">
                <Monster kind={kind} size={22} glow={false} /> Showing rooms haunted by the {MONSTERS[kind].name}.
                <button type="button" onClick={() => setKind(null)} className="min-h-8 rounded-lg px-2 text-ember-soft hover:bg-white/[0.05]">
                  Show all
                </button>
              </p>
            )}

            {view === "tree" ? (
              filtered.tree && filtered.tree.children.length ? (
                <FileTree root={filtered.tree} open={open} onToggle={toggle} onOpen={openFile} query={query} />
              ) : (
                <EmptyRooms onReset={() => (setQuery(""), setShow("all"), setKind(null))} />
              )
            ) : filtered.haunted.length || filtered.clear.length ? (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {filtered.haunted.map((f, i) => (
                  <RankedRow key={f.id} rank={i + 1} file={f} onOpen={() => openFile(f)} />
                ))}
                {filtered.clear.length > 0 && (
                  <li>
                    <details className="rounded-2xl border border-line bg-card/50" open={show === "clear" || !filtered.haunted.length}>
                      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm text-ink-2">
                        <Icon name="check" size={16} className="text-banished" /> {filtered.clear.length} clear file{filtered.clear.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="m-0 flex list-none flex-col gap-1 p-2 pt-0">
                        {filtered.clear.map((f) => (
                          <RankedRow key={f.id} file={f} onOpen={() => openFile(f)} />
                        ))}
                      </ul>
                    </details>
                  </li>
                )}
              </ol>
            ) : (
              <EmptyRooms onReset={() => (setQuery(""), setShow("all"), setKind(null))} />
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {first ? (
            <Button variant="primary" size="lg" onClick={() => openFile(first)} className="py-3 text-left whitespace-normal!">
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

function Stat({ label, value, icon, tone, hint }: { label: string; value: number; icon: ReactNode; tone?: "ember" | "banished"; hint?: string }) {
  return (
    <div className="map-glass flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3" title={hint}>
      <span
        aria-hidden="true"
        className={cx(
          "grid h-9 w-9 flex-none place-items-center rounded-xl",
          tone === "ember" ? "bg-ember/15 text-ember" : tone === "banished" ? "bg-banished/15 text-banished" : "bg-white/[0.05] text-ink-3",
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col-reverse leading-tight">
        <dt className="truncate text-xs text-ink-3">{label}</dt>
        <dd className="m-0 font-display text-[28px] font-bold">{value}</dd>
      </span>
    </div>
  );
}

function SeverityBar({ bySev, total }: { bySev: Map<Severity, number>; total: number }) {
  const sevs = ["HIGH", "MED", "LOW"] as Severity[];
  return (
    <>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        {total > 0 &&
          sevs.map((s) => <span key={s} style={{ width: `${((bySev.get(s) ?? 0) / total) * 100}%`, background: SEVERITY[s].bg }} className="h-full" />)}
      </div>
      {sevs.map((s) => (
        <span key={s} className="flex items-center justify-between gap-2 text-sm">
          <SeverityBadge severity={s} />
          <span className="font-mono">{bySev.get(s) ?? 0}</span>
        </span>
      ))}
    </>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl bg-well p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx(
            "min-h-9 rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap",
            value === v ? "bg-line-strong text-ink" : "text-ink-2 hover:bg-white/[0.04]",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function EmptyRooms({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Monster kind="wraith" size={64} glow={false} />
      <p className="m-0 text-ink-2">No room matches. Even the ghosts looked everywhere.</p>
      <Button size="sm" variant="outline" onClick={onReset}>
        Clear the filters
      </Button>
    </div>
  );
}

function RankedRow({ file, onOpen, rank }: { file: ReviewFile; onOpen: () => void; rank?: number }) {
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
          "map-tree-row group flex w-full items-center gap-3 rounded-2xl border text-left",
          rank ? "min-h-16 border-line bg-card/70 px-4 py-3 hover:border-ember/50" : "min-h-11 border-transparent px-3 py-1.5",
        )}
      >
        {rank && (
          <span aria-hidden="true" className={cx("w-9 flex-none font-display text-3xl leading-none font-bold", rank === 1 ? "text-ember" : "text-ink-4")}>
            {rank}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-sm text-ink">{nameOf(file.path)}</span>
          {dir && <span className="truncate font-mono text-xs text-ink-4">{dir}/</span>}
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
      <h1 className="m-0 font-brand text-5xl leading-none">No map to draw yet.</h1>
      <p className="m-0 max-w-md text-ink-2">Bring a GitHub repository or folder link, and the Haunted Map shows where every monster hides.</p>
      <ButtonLink href="/#start" variant="primary" size="lg">
        Bring a GitHub link
      </ButtonLink>
    </div>
  );
}
