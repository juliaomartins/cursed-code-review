import type { Finding, Language } from "../types";

export interface RuleContext {
  lines: string[];
  language: Language;
}

export type RawFinding = Omit<Finding, "id" | "status" | "severity"> & { severity?: Finding["severity"] };

export type Rule = (ctx: RuleContext) => RawFinding[];
