"use client";

import Link from "next/link";
import { MONSTERS, SEVERITY } from "@/lib/monsters";
import { findingLines } from "@/lib/review/apply";
import { fileStats, lurkingOf } from "@/lib/review/selectors";
import type { Finding, ReviewFile } from "@/lib/types";
import { Sun } from "../Daybreak";
import { LivingMonster } from "../LivingMonster";
import { Monster } from "../Monster";
import { Button, ButtonLink } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";

export interface DetailPanelProps {
  file: ReviewFile;
  finding: Finding | null;
  banishing: boolean;
  simple: boolean;
  nextFile: ReviewFile | null;
  onSimple: (v: boolean) => void;
  onBanish: () => void;
  onIgnore: () => void;
  onRestore: (id: string) => void;
  onReset: () => void;
  onSelectFile: (id: string) => void;
  onCopyFix: () => void;
  onSelect: (id: string) => void;
  /** Every monster in the scan is banished: the panel greets the morning. */
  daybreak?: boolean;
}

export function DetailPanel(props: DetailPanelProps) {
  const { file, finding } = props;
  const lurking = lurkingOf(file);
  return (
    <div className="flex flex-col gap-4">
      {finding && finding.status === "lurking" ? (
        <FindingDetail {...props} finding={finding} />
      ) : lurking.length ? (
        <PickPrompt count={lurking.length} onPick={() => props.onSelect(lurking[0].id)} />
      ) : (
        <AllClear {...props} />
      )}
      <Graveyard file={file} onRestore={props.onRestore} />
    </div>
  );
}

function FindingDetail({ finding, banishing, simple, onSimple, onBanish, onIgnore, onCopyFix }: DetailPanelProps & { finding: Finding }) {
  const m = MONSTERS[finding.kind];
  const sev = SEVERITY[finding.severity];
  const lines = findingLines(finding);
  const lineLabel = lines.length > 1 ? `LINES ${lines.join(" & ")}` : `LINE ${lines[0]}`;
  return (
    <div className="flex flex-col gap-4" aria-live="polite" aria-atomic="false">
      <div className="relative mx-auto h-[220px] w-[240px] sm:h-[250px] sm:w-[260px]">
        <svg aria-hidden="true" viewBox="0 0 260 260" className="absolute inset-0 h-full w-full animate-spin-slow">
          <defs>
            <radialGradient id="ccr-glow">
              <stop offset="0" stopColor="#FF8A3D" stopOpacity="0.28" />
              <stop offset="1" stopColor="#FF8A3D" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="130" cy="130" r="118" fill="url(#ccr-glow)" />
          <circle cx="130" cy="130" r="118" fill="none" stroke="#FF8A3D" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
          <circle cx="130" cy="130" r="98" fill="none" stroke="#FF8A3D" strokeOpacity="0.22" strokeWidth="1" />
          <path d="M130 32L215 179H45Z M130 228L45 81H215Z" fill="none" stroke="#FF8A3D" strokeOpacity="0.16" strokeWidth="1" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={finding.id} className={banishing ? "animate-banish" : "animate-float"}>
            <LivingMonster kind={finding.kind} size={150} label={m.name} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-[3px] font-mono text-[11px] font-bold tracking-[0.08em]" style={{ background: sev.bg, color: sev.fg }}>
            {finding.severity}
          </span>
          <span className="font-mono text-xs text-ink-3">
            {lineLabel} · {finding.bug.toUpperCase()}
          </span>
        </div>
        <h2 className="m-0 font-display text-[40px] leading-none font-bold">{m.name}</h2>
      </div>

      {finding.stale && (
        <div role="alert" className="flex gap-2 rounded-xl border border-sev-med/40 bg-sev-med/[0.08] p-3 text-[13px] text-warn-ink">
          <Icon name="alert" size={16} className="mt-px flex-none text-sev-med" />
          The code around this monster changed, so its fix no longer applies cleanly. Ignore it, or undo your last change.
        </div>
      )}

      <div role="group" aria-label="Explanation style" className="flex gap-1.5 rounded-xl bg-well p-1">
        {[
          { v: false, label: "What is wrong" },
          { v: true, label: "Explain it simply" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={simple === o.v}
            onClick={() => onSimple(o.v)}
            className={cx(
              "min-h-11 flex-1 rounded-[9px] text-sm font-medium text-ink transition-colors",
              simple === o.v ? "bg-line-strong" : "hover:bg-white/[0.04]",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="m-0 text-base leading-[1.55] text-pretty text-ink-body">{simple ? finding.eli5 : finding.why}</p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.16em] text-ink-3">THE SPELL (FIX)</span>
          <button
            type="button"
            onClick={onCopyFix}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-ink-3 hover:bg-white/5 hover:text-ink"
          >
            <Icon name="copy" size={14} />
            Copy fix
          </button>
        </div>
        <div className="scrollbar-thin relative overflow-x-auto rounded-[10px] border border-line font-mono text-[12.5px]">
          {finding.fix.before.map((l, i) => (
            <div key={`b${i}`} className="bg-[rgba(255,107,91,0.10)] px-3 py-1.5 whitespace-pre text-fix-del first:pt-2.5 last:pb-2.5">
              <span className="sr-only">Removed: </span>- {l}
            </div>
          ))}
          {finding.fix.after.length ? (
            finding.fix.after.map((l, i) => (
              <div key={`a${i}`} className="bg-[rgba(111,242,176,0.08)] px-3 py-1.5 whitespace-pre text-fix-add first:pt-2.5 last:pb-2.5">
                <span className="sr-only">Added: </span>+ {l}
              </div>
            ))
          ) : (
            <div className="bg-[rgba(111,242,176,0.05)] px-3 py-2.5 text-ink-3 italic">Lines removed</div>
          )}
        </div>
        {finding.fix.note && <p className="m-0 text-[13px] text-ink-3">{finding.fix.note}</p>}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" onClick={onBanish} disabled={banishing || finding.stale} className="min-h-[52px] flex-[2_1_160px] rounded-xl text-base">
          <Icon name="flame" strokeWidth={2.2} />
          {banishing ? "Banishing…" : "Banish"}
          <kbd aria-hidden="true" className="ml-1 hidden rounded border border-ember-ink/30 px-1.5 font-mono text-[11px] lg:inline">
            B
          </kbd>
        </Button>
        <Button variant="outline" onClick={onIgnore} disabled={banishing} className="min-h-[52px] flex-[1_1_100px] rounded-xl text-[15px] text-ink-body">
          Ignore
          <kbd aria-hidden="true" className="ml-1 hidden rounded border border-line-strong px-1.5 font-mono text-[11px] text-ink-3 lg:inline">
            I
          </kbd>
        </Button>
      </div>
      <p className="m-0 text-xs text-ink-3">{m.behavior}</p>
    </div>
  );
}

function PickPrompt({ count, onPick }: { count: number; onPick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Monster kind="wraith" size={80} className="opacity-70" />
      <h2 className="m-0 font-display text-3xl">{count} still lurking</h2>
      <p className="m-0 text-sm text-ink-3">Click a monster in the code to face it.</p>
      <Button variant="ember-outline" onClick={onPick}>
        Face the first one
      </Button>
    </div>
  );
}

function AllClear({ file, nextFile, onReset, onSelectFile, daybreak }: DetailPanelProps) {
  const s = fileStats(file);
  const none = s.total === 0;
  return (
    <div className="flex animate-rise flex-col items-center gap-3.5 px-3 py-10 text-center">
      {daybreak ? (
        <span className="relative grid h-[120px] w-[120px] place-items-center rounded-full bg-[radial-gradient(circle,rgba(255,200,90,0.45),rgba(255,200,90,0)_70%)]">
          <Sun size={84} />
        </span>
      ) : (
        <svg aria-hidden="true" width="96" height="120" viewBox="0 0 96 120">
          <circle cx="48" cy="64" r="44" fill="#FF8A3D" opacity="0.18" />
          <path d="M36 10H60M48 10V20" stroke="#ADA0C2" strokeWidth="3" strokeLinecap="round" />
          <rect x="28" y="20" width="40" height="8" rx="2" fill="#3D3154" />
          <path d="M30 28H66L62 96H34Z" fill="#1D1628" stroke="#ADA0C2" strokeWidth="3" strokeLinejoin="round" />
          <path d="M48 42C55 52 58 58 48 74C38 58 41 52 48 42Z" fill="#FF8A3D" className="origin-[48px_74px] animate-flicker" />
          <rect x="26" y="96" width="44" height="8" rx="2" fill="#3D3154" />
        </svg>
      )}
      <h2 className="m-0 font-display text-[40px] leading-none">{none ? "No monsters here." : daybreak ? "Daybreak." : "The crypt is clear."}</h2>
      <p className="m-0 text-[15px] leading-normal text-ink-3">
        {none
          ? "Every static check came back quiet. This file looks clean."
          : daybreak
            ? "Every monster is banished. The crypt stands in daylight."
            : "Every monster in this file is banished or ignored."}
      </p>
      {nextFile ? (
        <Button variant="primary" onClick={() => onSelectFile(nextFile.id)} className="min-h-[52px] rounded-xl px-6">
          Next: {nextFile.path.split("/").pop()} ({lurkingOf(nextFile).length})
          <Icon name="arrowRight" />
        </Button>
      ) : (
        <ButtonLink href="/report" variant="primary" className="min-h-[52px] rounded-xl px-6">
          See the report
        </ButtonLink>
      )}
      {nextFile && (
        <Link href="/report" className="text-sm">
          Skip to the report
        </Link>
      )}
      {!none && (
        <Button variant="outline" onClick={onReset} className="rounded-xl px-[18px] text-ink-body">
          <Icon name="refresh" size={16} />
          Summon them again
        </Button>
      )}
    </div>
  );
}

function Graveyard({ file, onRestore }: { file: ReviewFile; onRestore: (id: string) => void }) {
  const resolved = file.findings.filter((f) => f.status !== "lurking");
  if (!resolved.length) return null;
  return (
    <section aria-labelledby="graveyard" className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
      <h3 id="graveyard" className="m-0 font-mono text-[11px] font-normal tracking-[0.16em] text-ink-3">
        GRAVEYARD · {resolved.length}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {resolved.map((f) => (
          <li key={f.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm">
            <Monster kind={f.kind} size={28} glow={false} className="opacity-60 grayscale-[0.6]" />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{MONSTERS[f.kind].name}</span>
              <span className="text-xs text-ink-3">{f.bug}</span>
            </span>
            {f.status === "banished" ? (
              <span className="rounded-full bg-banished/[0.12] px-2 py-0.5 text-xs text-banished">Banished</span>
            ) : (
              <button
                type="button"
                onClick={() => onRestore(f.id)}
                aria-label={`Bring back the ignored ${MONSTERS[f.kind].name}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-strong px-2.5 text-xs text-ink-2 hover:border-ink-4 hover:text-ink"
              >
                <Icon name="restore" size={12} />
                Ignored
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
