import type { Finding, MonsterKind, Review, ReviewFile } from "../types";
import { applyFix, relocate } from "./apply";
import { lurkingOf } from "./selectors";

/** Kinds left out of "Banish all" unless asked: the Twin Ghosts fix adds a lock you must define. */
export const REVIEW_FIRST: MonsterKind[] = ["twins"];

export interface BulkPlanFile {
  file: ReviewFile;
  apply: Finding[];
  skip: Finding[];
}

/** What "Banish all" would do, per file, without changing anything. */
export function banishAllPlan(review: Review, fileIds: string[], skipKinds: MonsterKind[] = REVIEW_FIRST): BulkPlanFile[] {
  return review.files
    .filter((f) => fileIds.includes(f.id))
    .map((file) => {
      const lurking = lurkingOf(file);
      return {
        file,
        apply: lurking.filter((f) => !f.stale && !skipKinds.includes(f.kind)),
        skip: lurking.filter((f) => f.stale || skipKinds.includes(f.kind)),
      };
    })
    .filter((p) => p.apply.length || p.skip.length);
}

/**
 * Applies every planned fix in one file, one after another, re-locating the rest after each edit.
 * A fix whose code moved away is marked stale instead.
 */
export function banishAllInFile(file: ReviewFile, ids: string[]): { file: ReviewFile; banished: number } {
  let current = file;
  let banished = 0;
  for (const id of ids) {
    const finding = current.findings.find((f) => f.id === id);
    if (!finding || finding.status !== "lurking") continue;
    if (finding.stale) continue;
    const result = applyFix(current.code, finding);
    if (!result) {
      current = { ...current, findings: current.findings.map((x) => (x.id === id ? { ...x, stale: true } : x)) };
      continue;
    }
    const resolved = current.findings.map((x) => (x.id === id ? { ...x, status: "banished" as const, stale: false } : x));
    current = { ...current, code: result.code, findings: relocate(result.code, resolved, result) };
    banished++;
  }
  return { file: current, banished };
}
