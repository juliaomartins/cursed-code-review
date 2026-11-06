import { scan, toLines } from "../scanner";
import { ruleOf } from "../scanner/rules";
import type { Finding, ReviewFile } from "../types";
import type { ApplyResult } from "./apply";

/**
 * After a fix lands: re-run the analysis on the fixed code and check that the same rule no longer fires
 * on the lines the fix wrote. "still-detected" means the fix did not resolve what the scanner saw.
 */
export function verifyFix(file: Pick<ReviewFile, "language">, code: string, finding: Finding, result: ApplyResult): "resolved" | "still-detected" {
  const ruleId = ruleOf(finding).id;
  const from = result.start;
  const to = result.start + Math.max(result.added, 1) - 1;
  const again = scan(code, file.language).some(
    (f) => f.ruleId === ruleId && f.fix.startLine + f.lineOffsets[0] >= from && f.fix.startLine + f.lineOffsets[0] <= to,
  );
  return again ? "still-detected" : "resolved";
}

export interface RescanResult {
  file: ReviewFile;
  /** Lurking findings the new scan no longer reports. */
  resolved: number;
  /** Findings the new scan reports that were not known before. */
  added: number;
  /** Findings still lurking after the rescan. */
  remaining: number;
}

const firstLine = (f: Finding) => (f.fix.before[0] ?? "").trim();
const sameFinding = (a: Finding, b: Finding) => ruleOf(a).id === ruleOf(b).id && firstLine(a) === firstLine(b);

/**
 * Re-analyses a file's current code. Banished findings stay as history; ignored ones stay ignored when
 * the same rule still fires on the same code; lurking ones the scanner no longer sees are dropped
 * (resolved). PR files only keep findings on the lines the pull request changed.
 */
export function rescanFile(file: ReviewFile): RescanResult {
  let onlyLines: number[] | undefined;
  if (file.changedLines) {
    const orig = toLines(file.originalCode);
    const texts = new Set(file.changedLines.map((n) => orig[n - 1]?.trim()).filter(Boolean));
    onlyLines = toLines(file.code).flatMap((l, i) => (l.trim() && texts.has(l.trim()) ? [i + 1] : []));
  }
  const fresh = scan(file.code, file.language, { fileId: file.id, onlyLines });
  const history = file.findings.filter((f) => f.status === "banished");
  const known = file.findings.filter((f) => f.status !== "banished");
  const usedIds = new Set(history.map((f) => f.id));
  let added = 0;
  // Pair each fresh finding with at most one known finding (same rule, same code), nearest line first,
  // so dismissing one of two identical lines never dismisses the other.
  const used = new Set<string>();
  const merged = fresh.map((f) => {
    const prev = known
      .filter((k) => !used.has(k.id) && sameFinding(k, f))
      .sort((a, b) => Math.abs(a.fix.startLine - f.fix.startLine) - Math.abs(b.fix.startLine - f.fix.startLine))[0];
    if (prev) used.add(prev.id);
    else added++;
    let id = prev?.id ?? f.id;
    while (usedIds.has(id)) id = `${id}'`;
    usedIds.add(id);
    return prev ? { ...f, id, status: prev.status, ignoreReason: prev.ignoreReason } : { ...f, id };
  });
  const resolved = known.filter((k) => k.status === "lurking" && !used.has(k.id)).length;
  const findings = [...history, ...merged];
  return {
    file: { ...file, findings },
    resolved,
    added,
    remaining: findings.filter((f) => f.status === "lurking").length,
  };
}
