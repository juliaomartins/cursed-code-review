import type { Language } from "./types";

export type TokenType = "plain" | "keyword" | "string" | "comment" | "number" | "fn" | "type" | "variable";

export interface Token {
  type: TokenType;
  text: string;
}

const KEYWORDS: Record<Language, Set<string>> = {
  javascript: new Set(
    "import export from default const let var function async await return if else for while do break continue new class extends try catch finally throw typeof instanceof in of switch case this null undefined true false void delete yield".split(
      " ",
    ),
  ),
  typescript: new Set(
    "import export from default const let var function async await return if else for while do break continue new class extends implements try catch finally throw typeof instanceof in of switch case this null undefined true false void delete yield interface type enum as readonly public private protected keyof".split(
      " ",
    ),
  ),
  python: new Set(
    "import from as def class return if elif else for while in not and or is None True False try except finally raise with async await lambda pass break continue global nonlocal yield del assert".split(
      " ",
    ),
  ),
  php: new Set(
    "function return if else elseif for foreach while do break continue new class extends implements try catch finally throw echo print use namespace public private protected static null true false array as".split(
      " ",
    ),
  ),
};

const TS_TYPES = new Set(["string", "number", "boolean", "any", "unknown", "never", "Date", "Promise", "Record"]);

/** Splits one line of code into coloured tokens. Line-local by design: good enough for review display. */
export function tokenize(line: string, lang: Language): Token[] {
  const out: Token[] = [];
  const push = (type: TokenType, text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  const comment = lang === "python" ? /^#/ : lang === "php" ? /^(\/\/|#)/ : /^\/\//;
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (comment.test(rest)) {
      push("comment", rest);
      break;
    }
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      push("comment", text);
      i += text.length;
      continue;
    }
    const q = rest[0];
    const prefix = lang === "python" && /^[rfbu]{1,2}["']/i.test(rest) ? (/^[rfbu]{1,2}/i.exec(rest)?.[0] ?? "") : "";
    const quote = prefix ? rest[prefix.length] : q;
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = prefix.length + 1;
      while (j < rest.length && rest[j] !== quote) j += rest[j] === "\\" ? 2 : 1;
      const text = rest.slice(0, Math.min(j + 1, rest.length));
      push("string", text);
      i += text.length;
      continue;
    }
    const num = /^(0x[\da-f]+|\d[\d_]*(\.\d+)?)/i.exec(rest);
    if (num && !/[\w$]/.test(line[i - 1] ?? "")) {
      push("number", num[0]);
      i += num[0].length;
      continue;
    }
    const word = /^\$?[A-Za-z_][\w$]*/.exec(rest);
    if (word) {
      const w = word[0];
      const after = rest.slice(w.length);
      let type: TokenType = "plain";
      if (KEYWORDS[lang].has(w)) type = "keyword";
      else if (w.startsWith("$")) type = "variable";
      else if (/^\s*\(/.test(after)) type = "fn";
      else if (lang === "typescript" && (TS_TYPES.has(w) || /^[A-Z]/.test(w))) type = "type";
      push(type, w);
      i += w.length;
      continue;
    }
    push("plain", rest[0]);
    i += 1;
  }
  return out;
}
