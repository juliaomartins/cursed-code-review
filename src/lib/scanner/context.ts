import type { Finding, Language } from "../types";

export interface RuleContext {
  lines: string[];
  /** The same lines with comments blanked and string contents masked (see lexer.ts). */
  code: string[];
  language: Language;
}

export type RawFinding = Omit<Finding, "id" | "status" | "severity" | "ruleId"> & { severity?: Finding["severity"]; ruleId?: string };

export type Rule = (ctx: RuleContext) => RawFinding[];
