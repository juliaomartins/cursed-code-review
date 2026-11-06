import { toLines } from "../scanner";
import type { Finding, Fix } from "../types";

const trimEq = (a: string, b: string) => a.trim() === b.trim();

/**
 * Finds where `fix.before` currently lives in `lines` (1-based start line),
 * matching on trimmed text and preferring the occurrence nearest `hint`.
 */
export function locate(lines: string[], fix: Fix, hint = fix.startLine, exclude?: Set<number>): number | null {
  const len = fix.before.length;
  if (len === 0) return null;
  let best: number | null = null;
  for (let i = 0; i + len <= lines.length; i++) {
    if (exclude?.has(i + 1)) continue;
    let ok = true;
    for (let k = 0; k < len; k++) {
      if (!trimEq(lines[i + k], fix.before[k])) {
        ok = false;
        break;
      }
    }
    if (ok && (best === null || Math.abs(i + 1 - hint) < Math.abs(best - hint))) best = i + 1;
  }
  return best;
}

const leading = (s: string) => /^\s*/.exec(s)?.[0] ?? "";

export interface ApplyResult {
  code: string;
  start: number;
  removed: number;
  added: number;
}

/** True when `fix.before` sits exactly at `fix.startLine` (trimmed comparison). */
export function targetsCurrentCode(lines: string[], fix: Fix): boolean {
  const at = fix.startLine - 1;
  if (at < 0 || !fix.before.length || at + fix.before.length > lines.length) return false;
  return fix.before.every((l, k) => trimEq(lines[at + k], l));
}

/**
 * Applies a finding's fix to `code`. Returns null when the fix does not target the current code.
 * Strict on purpose: every edit in the app re-locates findings, so the fix must sit exactly where the
 * finding says. It never goes looking elsewhere, where an identical line may belong to another finding.
 */
export function applyFix(code: string, finding: Finding): ApplyResult | null {
  // A finding without an automatic fix has nothing to apply: never report it as fixed.
  if (finding.autofix === false) return null;
  const lines = toLines(code);
  if (!targetsCurrentCode(lines, finding.fix)) return null;
  const start = finding.fix.startLine;
  const expected = leading(finding.fix.before[0]);
  const actual = leading(lines[start - 1]);
  const after = finding.fix.after.map((l) => (expected !== actual && l.startsWith(expected) ? actual + l.slice(expected.length) : l));
  lines.splice(start - 1, finding.fix.before.length, ...after);
  return { code: lines.join("\n"), start, removed: finding.fix.before.length, added: after.length };
}

/**
 * After an edit, moves every still-lurking finding to wherever its code now lives.
 * Findings whose code disappeared are marked stale.
 */
export function relocate(code: string, findings: Finding[], edit?: { start: number; removed: number; added: number }): Finding[] {
  const lines = toLines(code);
  const delta = edit ? edit.added - edit.removed : 0;
  const hintOf = (f: Finding) => (edit && f.fix.startLine >= edit.start + edit.removed ? f.fix.startLine + delta : f.fix.startLine);
  // Identical code can appear twice. Each occurrence belongs to one finding: findings whose code is still
  // exactly where expected claim it first, the others may only move to an unclaimed occurrence.
  const key = (f: Finding, at: number) => `${f.ruleId ?? f.kind}|${f.fix.before.map((l) => l.trim()).join("\n")}|${at}`;
  const claimed = new Set<string>();
  for (const f of findings) if (f.status === "lurking" && targetsCurrentCode(lines, { ...f.fix, startLine: hintOf(f) })) claimed.add(key(f, hintOf(f)));
  return findings.map((f) => {
    if (f.status !== "lurking") return f;
    const hint = hintOf(f);
    let at: number | null = null;
    if (targetsCurrentCode(lines, { ...f.fix, startLine: hint })) at = hint;
    else {
      const taken = new Set<number>();
      for (let n = 1; n <= lines.length; n++) if (claimed.has(key(f, n))) taken.add(n);
      at = locate(lines, f.fix, hint, taken);
      if (at !== null) claimed.add(key(f, at));
    }
    if (at === null) return { ...f, stale: true };
    const before = lines.slice(at - 1, at - 1 + f.fix.before.length);
    if (at === f.fix.startLine && before.every((l, k) => l === f.fix.before[k]) && !f.stale) return f;
    const reindent = leading(before[0]);
    const old = leading(f.fix.before[0]);
    const after = f.fix.after.map((l) => (reindent !== old && l.startsWith(old) ? reindent + l.slice(old.length) : l));
    return { ...f, stale: false, fix: { ...f.fix, startLine: at, before, after } };
  });
}

/** The 1-based lines a finding currently haunts. */
export const findingLines = (f: Finding): number[] => f.lineOffsets.map((o) => f.fix.startLine + o);

export const primaryLine = (f: Finding): number => f.fix.startLine + f.lineOffsets[0];
