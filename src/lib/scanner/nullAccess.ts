import type { Rule, RawFinding } from "./context";
import { enclosingFunctionName, escapeRegExp, indentWidth, isCommentLine, isJsLike } from "./util";

const ELI5 = "You reach into a box for a toy, but the box might be empty. Peek inside first.";

interface Source {
  depth: number;
  desc: string;
}

function jsSource(rhs: string): Source | null {
  if (/\.find\(|\.findLast\(/.test(rhs)) return { depth: 1, desc: "`.find()`, which returns undefined when nothing matches" };
  if (/querySelector\(|getElementById\(|closest\(/.test(rhs))
    return { depth: 1, desc: "a DOM lookup that returns null when the element is missing" };
  if (/\.match\(|\.exec\(/.test(rhs)) return { depth: 1, desc: "a regex match that returns null when it fails" };
  if (/localStorage\.getItem\(|\.get\(/.test(rhs)) return { depth: 1, desc: "a lookup that returns nothing for a missing key" };
  if (/^await\b/.test(rhs)) return { depth: 2, desc: "an awaited call that can come back empty" };
  return null;
}

function pySource(rhs: string): Source | null {
  if (/\bre\.(match|search|fullmatch)\(/.test(rhs)) return { depth: 1, desc: "a regex match that returns None when it fails" };
  if (/\.get\(/.test(rhs)) return { depth: 1, desc: "`.get()`, which returns None for a missing key" };
  if (/\.(find_one|first|fetchone)\(/.test(rhs)) return { depth: 1, desc: "a query that returns None when no row matches" };
  return null;
}

function jsRule(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, "javascript")) return;
    const decl = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(.+)$/.exec(text);
    if (!decl) return;
    const [, v, rhs] = decl;
    const src = jsSource(rhs.trim());
    if (!src) return;
    const ev = escapeRegExp(v);
    const use = new RegExp(`(?<![\\w$.?])${ev}((?:\\.[A-Za-z_$][\\w$]*){${src.depth},})`);
    const guard = new RegExp(
      `if\\s*\\(\\s*!?\\s*${ev}\\s*[)&|]|(?<![\\w$.])${ev}\\s*(&&|\\?\\?|!==?|===?|\\?(?!\\.))|${ev}\\?\\.|(?:const|let|var)\\s+${ev}\\b`,
    );
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (isCommentLine(line, "javascript")) continue;
      if (guard.test(line)) return;
      const m = use.exec(line);
      if (!m) continue;
      const after = line.slice(m.index + m[0].length);
      if (/^\s*=(?!=)/.test(after) || /^\s*(\+\+|--)/.test(after)) return;
      const chain = m[1];
      const safe = `${v}${chain.replace(/\./g, "?.")}`;
      const fixed = line.slice(0, m.index) + safe + after;
      const prop = chain.split(".")[src.depth === 2 ? 2 : 1] ?? chain.split(".")[1];
      const fn = enclosingFunctionName(lines, j, "javascript");
      out.push({
        kind: "wraith",
        bug: "Null access",
        why: `\`${v}\` comes from ${src.desc}. Reading \`.${prop}\` on nothing throws a TypeError and crashes ${fn ? `\`${fn}()\`` : "this code"}.`,
        eli5: ELI5,
        fix: { startLine: j + 1, before: [line], after: [fixed] },
        lineOffsets: [0],
      });
      return;
    }
  });
  return out;
}

function pyRule(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, "python")) return;
    const decl = /^(\s*)([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/.exec(text);
    if (!decl) return;
    const [, , v, rhs] = decl;
    const src = pySource(rhs);
    if (!src) return;
    const baseIndent = indentWidth(text);
    const use = new RegExp(`(?<![\\w.])${v}\\.([A-Za-z_]\\w*)`);
    const guard = new RegExp(`\\b(if|elif|while|and|or|not|assert)\\s+(not\\s+)?${v}\\b|${v}\\s+is\\s+(not\\s+)?None`);
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "" || isCommentLine(line, "python")) continue;
      if (indentWidth(line) < baseIndent) return;
      if (guard.test(line)) return;
      const m = use.exec(line);
      if (!m) continue;
      const assign = /^(\s*)([\w.[\]'"]+\s*=(?!=)\s*)(.+?)\s*$/.exec(line);
      const ret = /^(\s*)return\s+(.+?)\s*$/.exec(line);
      let fixed: string | null = null;
      if (assign && use.test(assign[3])) fixed = `${assign[1]}${assign[2]}${assign[3]} if ${v} else None`;
      else if (ret) fixed = `${ret[1]}return ${ret[2]} if ${v} else None`;
      if (!fixed) return;
      const fn = enclosingFunctionName(lines, j, "python");
      out.push({
        kind: "wraith",
        bug: "Null access",
        why: `\`${v}\` comes from ${src.desc}. Calling \`.${m[1]}\` on None raises AttributeError and crashes ${fn ? `\`${fn}()\`` : "this code"}.`,
        eli5: ELI5,
        fix: { startLine: j + 1, before: [line], after: [fixed] },
        lineOffsets: [0],
      });
      return;
    }
  });
  return out;
}

export const nullAccessRule: Rule = ({ lines, language }) => {
  if (isJsLike(language)) return jsRule(lines);
  if (language === "python") return pyRule(lines);
  return [];
};
