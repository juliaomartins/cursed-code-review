import { findingMeta } from "../scanner/rules";
import type { Confidence, Finding, Severity } from "../types";
import { primaryLine } from "./apply";

const SEVERITY_WEIGHT: Record<Severity, number> = { CRITICAL: 100, HIGH: 70, MED: 40, LOW: 15 };
const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.4 };

/**
 * What to fix first: severity, scaled by how sure the rule is, plus a bonus when untrusted input was
 * seen reaching the problem. Exposure is only ever what a rule saw on the line, never guessed.
 */
export function priority(f: Finding): number {
  const { confidence } = findingMeta(f);
  return Math.round(SEVERITY_WEIGHT[f.severity] * CONFIDENCE_WEIGHT[confidence] + (f.exposure === "untrusted-input" ? 15 : 0));
}

/** Highest priority first; ties by file order then line. */
export function byPriority<T extends { f: Finding; path: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => priority(b.f) - priority(a.f) || a.path.localeCompare(b.path) || primaryLine(a.f) - primaryLine(b.f));
}

export const SEVERITY_LABEL: Record<Severity, string> = { CRITICAL: "Critical", HIGH: "High", MED: "Medium", LOW: "Low" };
