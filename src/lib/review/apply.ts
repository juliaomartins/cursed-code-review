import { toLines } from "../scanner";
import type { Finding, Fix } from "../types";

const trimEq = (a: string, b: string) => a.trim() === b.trim();

/**
 * Finds where `fix.before` currently lives in `lines` (1-based start line),
 * matching on trimmed text and preferring the occurrence nearest `hint`.
 */
export function locate(lines: string[], fix: Fix, hint = fix.startLine): number | null {
  const len = fix.before.length;
  if (len === 0) return null;
  let best: number | null = null;
  for (let i = 0; i + len <= lines.length; i++) {
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

/** Applies a finding's fix to `code`. Returns null when the target lines can no longer be found. */
export function applyFix(code: string, finding: Finding): ApplyResult | null {
  const lines = toLines(code);
  const start = locate(lines, finding.fix);
  if (start === null) return null;
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
  return findings.map((f) => {
    if (f.status !== "lurking") return f;
    const hint = edit && f.fix.startLine >= edit.start + edit.removed ? f.fix.startLine + delta : f.fix.startLine;
    const at = locate(lines, f.fix, hint);
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
