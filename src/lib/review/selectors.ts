import { SEVERITY } from "../monsters";
import type { Finding, Review, ReviewFile, Severity } from "../types";
import { primaryLine } from "./apply";

export interface Stats {
  total: number;
  lurking: number;
  banished: number;
  ignored: number;
  /** 0–100 */
  light: number;
}

export function statsOf(findings: Finding[]): Stats {
  const total = findings.length;
  const banished = findings.filter((f) => f.status === "banished").length;
  const ignored = findings.filter((f) => f.status === "ignored").length;
  const lurking = total - banished - ignored;
  const light = total === 0 ? 100 : Math.round(25 + (75 * banished) / total);
  return { total, lurking, banished, ignored, light };
}

/** Daybreak: nothing left lurking, and at least one monster was banished (not merely ignored). */
export const isDaybreak = (s: Stats): boolean => s.lurking === 0 && s.banished > 0;

export const fileStats = (file: ReviewFile): Stats => statsOf(file.findings);

export const reviewStats = (review: Review): Stats => statsOf(review.files.flatMap((f) => f.findings));

export function worstSeverity(findings: Finding[]): Severity | null {
  let worst: Severity | null = null;
  for (const f of findings) if (!worst || SEVERITY[f.severity].rank > SEVERITY[worst].rank) worst = f.severity;
  return worst;
}

export const lurkingOf = (file: ReviewFile): Finding[] =>
  file.findings.filter((f) => f.status === "lurking").sort((a, b) => primaryLine(a) - primaryLine(b));

/** The next lurking finding after `currentId` in reading order, wrapping around. */
export function nextLurking(file: ReviewFile, currentId: string | null, direction: 1 | -1 = 1): Finding | null {
  const list = lurkingOf(file);
  if (!list.length) return null;
  const idx = currentId ? list.findIndex((f) => f.id === currentId) : -1;
  if (idx === -1) {
    if (!currentId) return direction === 1 ? list[0] : list[list.length - 1];
    const cur = file.findings.find((f) => f.id === currentId);
    if (!cur) return list[0];
    const line = primaryLine(cur);
    const found = direction === 1 ? list.find((f) => primaryLine(f) > line) : [...list].reverse().find((f) => primaryLine(f) < line);
    return found ?? (direction === 1 ? list[0] : list[list.length - 1]);
  }
  return list[(idx + direction + list.length) % list.length];
}

export const activeFile = (review: Review): ReviewFile => review.files.find((f) => f.id === review.activeFileId) ?? review.files[0];

export function selectedFinding(review: Review): Finding | null {
  const file = activeFile(review);
  return file.findings.find((f) => f.id === review.selectedFindingId) ?? null;
}
