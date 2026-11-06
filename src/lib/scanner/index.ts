import { MONSTERS } from "../monsters";
import type { Finding, Language, Severity } from "../types";
import type { RawFinding, Rule } from "./context";
import { deadCodeRule } from "./deadCode";
import { swallowedErrorRule } from "./errors";
import { injectionRule } from "./injection";
import { maskSource } from "./lexer";
import { memoryLeakRule } from "./memoryLeak";
import { nullAccessRule } from "./nullAccess";
import { offByOneRule } from "./offByOne";
import { raceRule } from "./race";
import { RULES_META } from "./rules";
import { secretsRule } from "./secrets";
import { securityRules } from "./security";

const RULES: Rule[] = [injectionRule, ...securityRules, secretsRule, nullAccessRule, offByOneRule, memoryLeakRule, raceRule, swallowedErrorRule, deadCodeRule];

export const MAX_LINES = 1500;
/** Lines longer than this (minified bundles, data blobs) are skipped: no rule is reliable there. */
export const MAX_LINE_LENGTH = 2000;

export interface ScanOptions {
  fileId?: string;
  /** Only keep findings that touch these 1-based lines (PR mode). */
  onlyLines?: number[];
}

export interface ScanResult {
  findings: Finding[];
  /** Findings silenced by a `ccr-ignore` comment in the code. */
  suppressed: number;
  /** Lines skipped because they were too long to analyse reliably. */
  skippedLines: number;
}

/** Splits code into lines, normalising Windows line endings. */
export function toLines(code: string): string[] {
  return code.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * `// ccr-ignore` (or `# ccr-ignore`) on the finding's line or the line above silences it.
 * `ccr-ignore: sql-injection, xss` silences only those rules. Only comments count, never strings.
 */
const SUPPRESS = /ccr-ignore(?:\s*:\s*([\w-]+(?:\s*,\s*[\w-]+)*))?/;
function suppressedBy(line: string | undefined, masked: string | undefined, ruleId: string): boolean {
  if (!line || masked === undefined) return false;
  const m = SUPPRESS.exec(line);
  if (!m || masked[m.index] !== " ") return false; // must sit inside a comment (masked to spaces)
  if (!m[1]) return true;
  return m[1].split(/\s*,\s*/).includes(ruleId);
}

/** Severity with evidence: injection that visibly takes untrusted input is CRITICAL. */
function severityOf(raw: RawFinding, ruleId: string): Severity {
  if (raw.severity) return raw.severity;
  if (raw.exposure === "untrusted-input" && ["sql-injection", "command-injection", "code-injection"].includes(ruleId)) return "CRITICAL";
  return MONSTERS[raw.kind].defaultSeverity;
}

/** Rules that existed before rule ids keep their old finding ids, so saved reviews and links still match. */
const LEGACY_IDS = new Set(["sql-injection", "xss", "hardcoded-secret", "null-access", "off-by-one", "race-condition", "memory-leak", "dead-code"]);

/** Runs every rule, with full results: findings sorted by line, plus what was suppressed or skipped. */
export function scanDetailed(code: string, language: Language, opts: ScanOptions = {}): ScanResult {
  const all = toLines(code);
  // Overlong lines can't be analysed reliably and would make the regexes slow: blank them out.
  let skippedLines = 0;
  const lines = all.map((l) => {
    if (l.length <= MAX_LINE_LENGTH) return l;
    skippedLines++;
    return "";
  });
  const masked = maskSource(lines, language);
  const fileId = opts.fileId ?? "file";
  const only = opts.onlyLines ? new Set(opts.onlyLines) : null;
  const seen = new Set<string>();
  const findings: Finding[] = [];
  let suppressed = 0;
  for (const rule of RULES) {
    let raws: RawFinding[];
    try {
      raws = rule({ lines, code: masked, language });
    } catch {
      // A rule must never take the whole scan down on odd input; it simply reports nothing.
      raws = [];
    }
    for (const raw of raws) {
      const ruleId = raw.ruleId ?? "unknown";
      const meta = RULES_META[ruleId];
      const primary = raw.fix.startLine + raw.lineOffsets[0];
      // One finding per rule per line: a second match of the same rule on the same line is a duplicate.
      const key = `${ruleId}:${primary}`;
      if (seen.has(key)) continue;
      const touched = raw.lineOffsets.map((o) => raw.fix.startLine + o);
      const span = raw.fix.before.map((_, k) => raw.fix.startLine + k);
      if (only && !touched.concat(span).some((l) => only.has(l))) continue;
      seen.add(key);
      // A comment on the line itself, or a comment-only line just above (code above can't silence it by accident).
      const onLine = suppressedBy(lines[primary - 1], masked[primary - 1], ruleId);
      const above = masked[primary - 2]?.trim() === "" && suppressedBy(lines[primary - 2], masked[primary - 2], ruleId);
      if (onLine || above) {
        suppressed++;
        continue;
      }
      const line = lines[primary - 1] ?? "";
      findings.push({
        ...raw,
        // Ids keep the monster kind so ids from earlier versions (and saved reviews) still line up.
        id: LEGACY_IDS.has(ruleId) ? `${fileId}:${raw.kind}:${primary}` : `${fileId}:${raw.kind}:${primary}:${ruleId}`,
        ruleId,
        category: raw.category ?? meta?.category,
        confidence: raw.confidence ?? meta?.confidence,
        autofix: raw.autofix ?? meta?.autofix ?? true,
        column: raw.column ?? (/\S/.exec(line)?.index ?? 0) + 1,
        severity: severityOf(raw, ruleId),
        status: "lurking",
      });
    }
  }
  findings.sort((a, b) => a.fix.startLine + a.lineOffsets[0] - (b.fix.startLine + b.lineOffsets[0]) || (a.column ?? 0) - (b.column ?? 0));
  return { findings, suppressed, skippedLines };
}

/** Runs every static rule over the code and returns monsters sorted by line. */
export function scan(code: string, language: Language, opts: ScanOptions = {}): Finding[] {
  return scanDetailed(code, language, opts).findings;
}

const LANGUAGE_HINTS: [Language, RegExp][] = [
  ["php", /<\?php|\$[A-Za-z_]\w*\s*=|->\w+\(|\becho\b/],
  ["python", /^\s*(def|class)\s+\w+.*:\s*$|^\s*import\s+\w+\s*$|^\s*from\s+\w+\s+import\b|\bself\.|\belif\b|\bNone\b/m],
  ["typescript", /:\s*(string|number|boolean|void|unknown|any)\b|\binterface\s+\w+|\btype\s+\w+\s*=|\bimport\s+type\b|<\w+>\(/],
  ["javascript", /\b(const|let|var|function|=>|require\(|console\.log)\b/],
];

/** Guesses the language of a snippet. Returns null when there is no clear signal. */
export function detectLanguage(code: string): Language | null {
  for (const [lang, re] of LANGUAGE_HINTS) if (re.test(code)) return lang;
  return null;
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  php: "PHP",
};

export const LANGUAGE_EXT: Record<Language, string> = { javascript: "js", typescript: "ts", python: "py", php: "php" };

export function languageFromPath(path: string): Language {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "py") return "python";
  if (ext === "php") return "php";
  if (ext === "ts" || ext === "tsx") return "typescript";
  return "javascript";
}
