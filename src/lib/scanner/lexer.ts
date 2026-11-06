import type { Language } from "../types";

/**
 * A small lexer that tells code apart from comments and strings, so rules never fire on a keyword that
 * only appears in a comment or inside a string.
 *
 * `maskSource` returns one masked line per source line, with the same length and columns:
 * - comment text becomes spaces;
 * - string contents become `_`, the quotes stay (so a rule can still see "a string starts here").
 *
 * It is deliberately forgiving: unterminated strings end at the end of the line (except template
 * literals and triple-quoted strings, which may span lines), and it never throws, whatever the input.
 * Regex literals are not recognised; a quote inside one can mask the rest of that line only.
 */
export function maskSource(lines: string[], language: Language): string[] {
  const py = language === "python";
  const hashComments = py || language === "php";
  const out: string[] = [];
  // State carried across lines.
  let block = false; // inside /* */
  let triple: string | null = null; // inside ''' or """ (Python)
  let template = false; // inside `...` (JS/TS)

  for (const line of lines) {
    const chars = line.split("");
    let i = 0;
    const n = chars.length;
    const blank = (from: number, to: number, ch: string) => {
      for (let k = from; k < to && k < n; k++) chars[k] = ch;
    };

    while (i < n) {
      if (block) {
        const end = line.indexOf("*/", i);
        if (end === -1) {
          blank(i, n, " ");
          i = n;
        } else {
          blank(i, end + 2, " ");
          i = end + 2;
          block = false;
        }
        continue;
      }
      if (triple) {
        const end = line.indexOf(triple, i);
        if (end === -1) {
          blank(i, n, "_");
          i = n;
        } else {
          blank(i, end, "_");
          i = end + 3;
          triple = null;
        }
        continue;
      }
      if (template) {
        // Template literal body: mask until the closing backtick (escapes respected).
        let k = i;
        while (k < n && line[k] !== "`") k += line[k] === "\\" ? 2 : 1;
        blank(i, Math.min(k, n), "_");
        if (k < n) {
          template = false;
          i = k + 1;
        } else i = n;
        continue;
      }

      const c = line[i];
      const next = line[i + 1];
      if (!py && c === "/" && next === "/") {
        blank(i, n, " ");
        break;
      }
      if (hashComments && c === "#") {
        blank(i, n, " ");
        break;
      }
      if (!py && c === "/" && next === "*") {
        block = true;
        blank(i, i + 2, " ");
        i += 2;
        continue;
      }
      if (py && (line.startsWith('"""', i) || line.startsWith("'''", i))) {
        triple = line.slice(i, i + 3);
        i += 3;
        continue;
      }
      if (!py && c === "`") {
        template = true;
        i += 1;
        continue;
      }
      if (c === '"' || c === "'") {
        let k = i + 1;
        while (k < n && line[k] !== c) k += line[k] === "\\" ? 2 : 1;
        blank(i + 1, Math.min(k, n), "_");
        i = k + 1;
        continue;
      }
      i += 1;
    }
    out.push(chars.join(""));
  }
  return out;
}

/** True when the masked line has any code on it (not just a comment or blank). */
export const hasCode = (masked: string): boolean => masked.trim() !== "";

/** True when position `index` of a line is real code (not inside a comment or string). */
export function isCodeAt(masked: string, original: string, index: number): boolean {
  return index >= 0 && index < original.length && original[index] !== " " && masked[index] === original[index];
}

/** True when `original[index]` opens a string literal that the lexer saw as code (not inside a comment). */
export function opensString(masked: string, original: string, index: number): boolean {
  const q = original[index];
  return (q === '"' || q === "'" || q === "`") && masked[index] === q;
}
