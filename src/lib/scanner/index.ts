import { MONSTERS } from "../monsters";
import type { Finding, Language } from "../types";
import type { Rule } from "./context";
import { deadCodeRule } from "./deadCode";
import { injectionRule } from "./injection";
import { memoryLeakRule } from "./memoryLeak";
import { nullAccessRule } from "./nullAccess";
import { offByOneRule } from "./offByOne";
import { raceRule } from "./race";
import { secretsRule } from "./secrets";

const RULES: Rule[] = [injectionRule, secretsRule, nullAccessRule, offByOneRule, memoryLeakRule, raceRule, deadCodeRule];

export const MAX_LINES = 1500;

export interface ScanOptions {
  fileId?: string;
  /** Only keep findings that touch these 1-based lines (PR mode). */
  onlyLines?: number[];
}

/** Splits code into lines, normalising Windows line endings. */
export function toLines(code: string): string[] {
  return code.replace(/\r\n?/g, "\n").split("\n");
}

/** Runs every static rule over the code and returns monsters sorted by line. */
export function scan(code: string, language: Language, opts: ScanOptions = {}): Finding[] {
  const lines = toLines(code);
  const fileId = opts.fileId ?? "file";
  const only = opts.onlyLines ? new Set(opts.onlyLines) : null;
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const rule of RULES) {
    for (const raw of rule({ lines, language })) {
      const primary = raw.fix.startLine + raw.lineOffsets[0];
      const id = `${fileId}:${raw.kind}:${primary}`;
      if (seen.has(id)) continue;
      const touched = raw.lineOffsets.map((o) => raw.fix.startLine + o);
      const span = raw.fix.before.map((_, k) => raw.fix.startLine + k);
      if (only && !touched.concat(span).some((l) => only.has(l))) continue;
      seen.add(id);
      findings.push({ ...raw, id, severity: raw.severity ?? MONSTERS[raw.kind].defaultSeverity, status: "lurking" });
    }
  }
  return findings.sort((a, b) => a.fix.startLine + a.lineOffsets[0] - (b.fix.startLine + b.lineOffsets[0]));
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
