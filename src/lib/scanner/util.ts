import type { Language } from "../types";

export const indentOf = (line: string): string => /^\s*/.exec(line)?.[0] ?? "";

export const indentWidth = (line: string): number => indentOf(line).replace(/\t/g, "    ").length;

export const isJsLike = (lang: Language): boolean => lang === "javascript" || lang === "typescript";

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the line is (only) a comment in the given language. */
export function isCommentLine(line: string, lang: Language): boolean {
  const t = line.trim();
  if (lang === "python") return t.startsWith("#");
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || (lang === "php" && t.startsWith("#"));
}

/** apiKey → API_KEY, db-password → DB_PASSWORD, API_KEY → API_KEY */
export function toUpperSnake(name: string): string {
  return name
    .replace(/^\$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/** Picks a quote character that does not appear in `s`, preferring the given one. */
export function pickQuote(s: string, preferred: "'" | '"'): string {
  if (!s.includes(preferred)) return preferred;
  const other = preferred === "'" ? '"' : "'";
  if (!s.includes(other)) return other;
  return "`";
}

/** Finds the name of the function enclosing line `index` (0-based), if any. */
export function enclosingFunctionName(lines: string[], index: number, lang: Language): string | null {
  const patterns =
    lang === "python"
      ? [/^\s*(?:async\s+)?def\s+(\w+)/]
      : lang === "php"
        ? [/function\s+(\w+)/]
        : [/function\s*\*?\s*([A-Za-z_$][\w$]*)/, /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/, /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/];
  for (let i = index; i >= 0; i--) {
    for (const p of patterns) {
      const m = p.exec(lines[i]);
      if (m && !/^(if|for|while|switch|catch)$/.test(m[1])) return m[1];
    }
  }
  return null;
}
