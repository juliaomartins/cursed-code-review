"use client";

import Link from "next/link";
import { MONSTERS, SEVERITY } from "@/lib/monsters";
import { findingLines, primaryLine as primaryLineOf } from "@/lib/review/apply";
import { fileStats, lurkingOf } from "@/lib/review/selectors";
import { findingMeta } from "@/lib/scanner/rules";
import { statusLabel } from "@/lib/report";
import type { Finding, IgnoreReason, ReviewFile } from "@/lib/types";
import { useState } from "react";
import { Sun } from "../Daybreak";
import { Creature } from "../fx/Creature";
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
  onIgnore: (reason?: IgnoreReason) => void;
  onRestore: (id: string) => void;
  onReset: () => void;
  onSelectFile: (id: string) => void;
  onCopyFix: () => void;
  onSelect: (id: string) => void;
  /** Every monster in the scan is banished: the panel greets the morning. */
  daybreak?: boolean;
  /** Length of the banishment now playing, in ms. */
  banishMs?: number;
  /** The selected monster's fix just failed to apply. */
  resisting?: boolean;
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

function FindingDetail({ finding, banishing, banishMs, resisting, simple, onSimple, onBanish, onIgnore, onCopyFix }: DetailPanelProps & { finding: Finding }) {
  const m = MONSTERS[finding.kind];
  const meta = findingMeta(finding);
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
          <Creature
            key={finding.id}
            kind={finding.kind}
            severity={finding.severity}
            reactOnMount
            idle={false}
            banishing={banishing}
            banishMs={banishMs}
            resisting={resisting}
            scale={2.6}
            seed={primaryLineOf(finding)}
          >
            <span className={cx("block", !banishing && "animate-float")}>
              <LivingMonster kind={finding.kind} size={150} label={m.name} />
            </span>
          </Creature>
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
        <FindingFacts finding={finding} />
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
      {!simple && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-well/60 p-3.5 text-[14px] leading-[1.5]">
          <p className="m-0">
            <span className="font-semibold text-ink">Impact. </span>
            <span className="text-ink-2">{meta.rule.impact}</span>
          </p>
          <p className="m-0">
            <span className="font-semibold text-ink">How to fix. </span>
            <span className="text-ink-2">{meta.rule.remediation}</span>
          </p>
        </div>
      )}

      {!meta.autofix ? (
        <div role="note" className="flex flex-col gap-1.5 rounded-xl border border-sev-med/40 bg-sev-med/[0.07] p-3.5 text-[14px] leading-[1.5]">
          <span className="font-semibold text-warn-ink">No safe automatic fix</span>
          <span className="text-ink-2">{finding.fix.note}</span>
          <span className="text-ink-3">Fix it in your editor, then dismiss it as fixed outside the app.</span>
        </div>
      ) : (
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
      )}

      <div className="flex flex-wrap gap-2.5">
        {meta.autofix && (
          <Button variant="primary" onClick={onBanish} disabled={banishing || finding.stale} className="min-h-[52px] flex-[2_1_160px] rounded-xl text-base">
            <Icon name="flame" strokeWidth={2.2} />
            {banishing ? "Banishing…" : "Banish"}
            <kbd aria-hidden="true" className="ml-1 hidden rounded border border-ember-ink/30 px-1.5 font-mono text-[11px] lg:inline">
              B
            </kbd>
          </Button>
        )}
        <IgnoreMenu disabled={banishing} manual={!meta.autofix} onIgnore={onIgnore} />
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
              <span
                title={statusLabel(f)}
                className={cx(
                  "rounded-full px-2 py-0.5 text-xs",
                  f.verification === "still-detected" ? "bg-sev-med/[0.14] text-warn-ink" : "bg-banished/[0.12] text-banished",
                )}
              >
                {f.verification === "resolved" ? "Fixed ✓ re-scan clean" : f.verification === "still-detected" ? "Fixed · still detected" : "Banished"}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRestore(f.id)}
                aria-label={`Bring back the ignored ${MONSTERS[f.kind].name}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-strong px-2.5 text-xs text-ink-2 hover:border-ink-4 hover:text-ink"
              >
                <Icon name="restore" size={12} />
                {f.ignoreReason ? statusLabel(f).replace("Dismissed · ", "") : "Ignored"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rule id, category, confidence, exact location, references, and whether untrusted input was seen. */
function FindingFacts({ finding }: { finding: Finding }) {
  const meta = findingMeta(finding);
  const line = primaryLineOf(finding);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] text-ink-3">
        <span className="rounded bg-well px-1.5 py-0.5 text-ink-2">{meta.ruleId}</span>
        <span>{meta.category}</span>
        <span aria-hidden="true">·</span>
        <span>
          confidence{" "}
          <span className={cx(meta.confidence === "high" ? "text-ink" : meta.confidence === "low" ? "text-warn-ink" : "text-ink-2")}>{meta.confidence}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          L{line}
          {finding.column ? `:C${finding.column}` : ""}
        </span>
        {meta.references.map((r) => (
          <a
            key={r.label}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-6 items-center gap-0.5 underline decoration-dotted underline-offset-2"
          >
            {r.label}
            <Icon name="external" size={11} />
          </a>
        ))}
      </p>
      {finding.exposure === "untrusted-input" && (
        <p className="m-0 inline-flex items-center gap-1.5 self-start rounded-full bg-sev-high/[0.12] px-2.5 py-1 text-[12px] font-medium text-sev-high">
          <Icon name="alert" size={13} /> Untrusted input reaches this line
        </p>
      )}
      {meta.confidence === "low" && (
        <p className="m-0 text-[12px] text-ink-3">Potential risk: the scanner could not confirm this one. Review it before acting.</p>
      )}
    </div>
  );
}

const REASONS: [IgnoreReason | undefined, string, string][] = [
  ["false-positive", "False positive", "The code is safe; the rule is wrong here."],
  ["accepted-risk", "Accepted risk", "Known and accepted, e.g. internal tool."],
  ["fix-elsewhere", "Fixed outside the app", "Fixed in my editor or another branch."],
  [undefined, "Just ignore", "No reason recorded."],
];

/** Ignore with a reason, so the report says why a finding was dismissed. */
function IgnoreMenu({ disabled, manual, onIgnore }: { disabled: boolean; manual: boolean; onIgnore: (reason?: IgnoreReason) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-[1_1_100px]">
      <Button
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
        className="min-h-[52px] w-full rounded-xl text-[15px] text-ink-body"
      >
        {manual ? "Dismiss…" : "Ignore"}
        <kbd aria-hidden="true" className="ml-1 hidden rounded border border-line-strong px-1.5 font-mono text-[11px] text-ink-3 lg:inline">
          I
        </kbd>
      </Button>
      {open && (
        <div
          role="group"
          aria-label="Why are you dismissing it?"
          className="absolute right-0 bottom-full z-20 mb-2 flex w-[min(300px,80vw)] flex-col gap-1 rounded-xl border border-line-strong bg-card p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          {REASONS.map(([reason, label, hint]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setOpen(false);
                onIgnore(reason);
              }}
              className="flex min-h-11 flex-col items-start rounded-lg px-3 py-1.5 text-left hover:bg-white/[0.05]"
            >
              <span className="text-sm font-medium text-ink">{label}</span>
              <span className="text-xs text-ink-3">{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
