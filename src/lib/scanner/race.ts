import type { Rule, RawFinding } from "./context";
import { escapeRegExp, indentOf, indentWidth, isJsLike } from "./util";

const ELI5 = "Two kids check the cookie jar at the same time, both see one cookie, and both promise it to a friend. Take turns holding the jar.";

const SAFE = /transaction|lock|mutex|runExclusive|atomic|FOR UPDATE/i;

function jsRule(lines: string[], code: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  code.forEach((text, i) => {
    const a = /^(\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*await\s+[\w$.]+\.(get|find|read|fetch|load)\w*\(/.exec(text);
    if (!a) return;
    const v = a[2];
    const b = new RegExp(`\\bawait\\s+[\\w$.]+\\.(set|update|save|write|put|insert)\\w*\\(.*\\b${escapeRegExp(v)}\\b`);
    for (let j = i + 1; j < Math.min(lines.length, i + 11); j++) {
      if (SAFE.test(lines[j]) || (i > 0 && SAFE.test(lines[i - 1]))) return;
      if (!b.test(code[j]) || indentWidth(lines[j]) < indentWidth(text)) continue;
      let end = j;
      const depth = (k: number) => code.slice(i, k + 1).reduce((d, l) => d + (l.match(/\{/g)?.length ?? 0) - (l.match(/\}/g)?.length ?? 0), 0);
      while (depth(end) > 0 && end < lines.length - 1) end++;
      const ind = a[1];
      const before = lines.slice(i, end + 1);
      out.push({
        ruleId: "race-condition",
        kind: "twins",
        bug: "Race condition",
        why: `\`${v}\` is read on one line and written back ${j - i} line${j - i === 1 ? "" : "s"} later, with an \`await\` in between. Two requests can read the same old value and both write, so one update is silently lost.`,
        eli5: ELI5,
        fix: {
          startLine: i + 1,
          before,
          after: [`${ind}const release = await lock.acquire();`, ...before, `${ind}release();`],
          note: "Uses a shared mutex, e.g. `const lock = new Mutex()` from async-mutex. In production, release inside finally.",
        },
        lineOffsets: [0, j - i],
      });
      return;
    }
  });
  return out;
}

function pyRule(lines: string[], code: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  const lockDecl = lines.map((l) => /^([A-Za-z_]*lock[A-Za-z_]*)\s*=/i.exec(l)?.[1]).find(Boolean);
  const lockName = lockDecl ?? "lock";
  code.forEach((text, i) => {
    const a = /^(\s*)([A-Za-z_]\w*)\s*=\s*(await\s+)?[\w.]*?(get|read|load|fetch)_?\w*\(/.exec(text);
    if (!a) return;
    const v = a[2];
    const width = indentWidth(text);
    const b = new RegExp(`\\b(set|write|save|update|put)_?\\w*\\(.*\\b${v}\\b`);
    for (let j = i + 1; j < Math.min(lines.length, i + 11); j++) {
      const lj = lines[j];
      if (lj.trim() === "") continue;
      if (indentWidth(lj) < width) return;
      if (/\bwith\b.*lock|acquire\(/i.test(lj) || (i > 0 && /\bwith\b.*lock|acquire\(/i.test(lines[i - 1]))) return;
      if (!b.test(code[j])) continue;
      let end = j;
      while (end + 1 < lines.length && (lines[end + 1].trim() === "" || indentWidth(lines[end + 1]) > width)) end++;
      while (end > j && lines[end].trim() === "") end--;
      const before = lines.slice(i, end + 1);
      const ind = indentOf(text);
      out.push({
        ruleId: "race-condition",
        kind: "twins",
        bug: "Race condition",
        why: `\`${v}\` is read, checked, then written back ${j - i} lines later. Two threads can both read the same old value and both write, so money (or data) appears out of nowhere.`,
        eli5: ELI5,
        fix: {
          startLine: i + 1,
          before,
          after: [`${ind}${a[3] ? "async with" : "with"} ${lockName}:`, ...before.map((l) => (l.trim() === "" ? l : `    ${l}`))],
          note: lockDecl ? undefined : "Define a shared `lock = threading.Lock()` at module level.",
        },
        lineOffsets: [0, j - i],
      });
      return;
    }
  });
  return out;
}

export const raceRule: Rule = ({ lines, code, language }) => {
  if (isJsLike(language)) return jsRule(lines, code);
  if (language === "python") return pyRule(lines, code);
  return [];
};
