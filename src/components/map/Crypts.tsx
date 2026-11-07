"use client";

import { timeAgo, type ExploredScan } from "@/lib/explored";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";

type State = "here" | "explored" | "unexplored";

interface CryptsProps {
  folders: { path: string; count: number }[];
  /** Readable files in the whole repository, and how many one scan reads, when known. */
  total?: number;
  scanned?: number;
  scans: Record<string, ExploredScan>;
  /** The folder this map shows: "" for the whole repository. */
  current: string;
  busy: boolean;
  error: string | null;
  onScan: (folder: string) => void;
  now: number;
}

/** The repository's folders as tombstones: which ones you have explored, which still wait in the dark. */
export function Crypts({ folders, total, scanned, scans, current, busy, error, onScan, now }: CryptsProps) {
  const list = folders.filter((f) => f.path !== "(root)");
  const stateOf = (path: string): State => (path === current ? "here" : scans[path] ? "explored" : "unexplored");
  const explored = list.filter((f) => stateOf(f.path) !== "unexplored").length;
  const repoScan = scans[""];

  return (
    <section aria-labelledby="crypts-title" className="codex-frame map-glass flex flex-col gap-5 rounded-3xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="crypts-title" className="m-0 font-display text-[34px] leading-none font-bold">
            Crypts to explore
          </h2>
          <p className="m-0 max-w-2xl text-[15px] text-ink-2">
            {total && scanned
              ? `This repository has ${total} files the crypt can read. One scan reads ${scanned}, so each folder is its own crypt. Explore them one by one.`
              : "Each folder is its own crypt. Scan one to see every file in it."}
          </p>
        </div>
        <div className="flex min-w-[200px] flex-col gap-1.5" aria-live="polite">
          <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">
            EXPLORED {explored} OF {list.length}
          </span>
          <div className="flex gap-1" aria-hidden="true">
            {list.map((f) => (
              <span
                key={f.path}
                className={cx(
                  "h-2 flex-1 rounded-full",
                  stateOf(f.path) === "here" ? "bg-ember shadow-[0_0_8px_#C9A86A]" : stateOf(f.path) === "explored" ? "bg-banished/70" : "bg-track",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-3 p-0">
        {current !== "" && (
          <li>
            <Stone
              state={repoScan ? "explored" : "unexplored"}
              title="Whole repo"
              detail={repoScan ? `${repoScan.files} files · ${monsters(repoScan.monsters)}` : "Back to the top"}
              action="Back to the whole repository"
              icon="arrowLeft"
              disabled={busy}
              onClick={() => onScan("")}
            />
          </li>
        )}
        {list.map((f) => {
          const state = stateOf(f.path);
          const scan = scans[f.path];
          return (
            <li key={f.path}>
              <Stone
                state={state}
                title={`${f.path}/`}
                count={f.count}
                detail={
                  state === "here"
                    ? "You are here"
                    : scan
                      ? `${monsters(scan.monsters)} · ${timeAgo(scan.at, now)}`
                      : `Unexplored · ${f.count} file${f.count === 1 ? "" : "s"}`
                }
                action={state === "unexplored" ? `Scan ${f.path}/` : `Scan ${f.path}/ again`}
                disabled={busy}
                onClick={() => onScan(f.path)}
              />
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="m-0 text-sm text-sev-high">
          {error}
        </p>
      )}
    </section>
  );
}

const monsters = (n: number) => (n === 0 ? "clear" : `${n} monster${n === 1 ? "" : "s"}`);

function Stone({
  state,
  title,
  count,
  detail,
  action,
  icon,
  disabled,
  onClick,
}: {
  state: State;
  title: string;
  count?: number;
  detail: string;
  action: string;
  icon?: "arrowLeft";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-state={state}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${title} ${count !== undefined ? `${count} files, ` : ""}${detail}. ${action}`}
      className={cx(
        "map-stone group flex h-full min-h-[150px] w-full flex-col items-center justify-start gap-1.5 border px-3 pt-8 pb-4 text-center disabled:opacity-60",
        state === "unexplored" ? "border-dashed border-line-strong" : state === "explored" ? "border-banished/40" : "border-ember/70",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "grid h-9 w-9 place-items-center rounded-full",
          state === "here" ? "bg-ember/20 text-ember" : state === "explored" ? "bg-banished/15 text-banished" : "bg-white/[0.04] text-ink-4",
        )}
      >
        {icon ? (
          <Icon name={icon} size={18} />
        ) : state === "explored" ? (
          <Icon name="check" size={18} strokeWidth={2.6} />
        ) : state === "here" ? (
          <Icon name="flame" size={18} />
        ) : (
          <GhostIcon />
        )}
      </span>
      <span className="max-w-full truncate font-mono text-[15px] text-ink">{title}</span>
      {count !== undefined && <span className="font-display text-2xl leading-none font-bold text-ink-2">{count}</span>}
      <span className={cx("text-xs", state === "here" ? "text-ember-soft" : state === "explored" ? "text-banished" : "text-ink-3")}>{detail}</span>
      <span
        className="mt-1 text-[11px] font-medium text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        {state === "unexplored" ? "Scan it →" : "Scan again ↻"}
      </span>
    </button>
  );
}

function GhostIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.5 2-2-2-2 2-2.5-2z" />
      <path d="M9.5 11h.01M14.5 11h.01" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  );
}
