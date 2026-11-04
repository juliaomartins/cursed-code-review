import type { Rule, RawFinding } from "./context";
import { enclosingFunctionName, escapeRegExp, indentOf, isCommentLine, isJsLike } from "./util";

const ELI5 = "You keep putting toys in a bag and never take any out. One day the bag bursts.";
const LIMIT = 1000;

function jsRule(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const decl = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(\[\]|\{\}|new\s+(Map|Set|Array)\b)/.exec(text);
    if (!decl) return;
    const name = decl[1];
    const ev = escapeRegExp(name);
    const evicts = new RegExp(`(?<![\\w$.])${ev}\\.(shift|pop|splice|delete|clear)\\(|(?<![\\w$.])${ev}\\.length\\s*=|(?<![\\w$.])${ev}\\s*=(?!=)`);
    if (lines.some((l, j) => j !== i && evicts.test(l))) return;
    const mut = new RegExp(`(?<![\\w$.])${ev}(?:\\.(push|unshift|set|add)\\(|\\[[^\\]]+\\]\\s*=(?!=))`);
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (j === i || indentOf(line).length === 0 || isCommentLine(line, "javascript")) continue;
      const m = mut.exec(line);
      if (!m) continue;
      const ind = indentOf(line);
      const op = m[1];
      let guard: string;
      if (op === "push") guard = `if (${name}.length > ${LIMIT}) ${name}.shift();`;
      else if (op === "unshift") guard = `if (${name}.length > ${LIMIT}) ${name}.pop();`;
      else if (op === "set") guard = `if (${name}.size > ${LIMIT}) ${name}.delete(${name}.keys().next().value);`;
      else if (op === "add") guard = `if (${name}.size > ${LIMIT}) ${name}.delete(${name}.values().next().value);`;
      else guard = `if (Object.keys(${name}).length > ${LIMIT}) delete ${name}[Object.keys(${name})[0]];`;
      const fn = enclosingFunctionName(lines, j, "javascript");
      out.push({
        kind: "leech",
        bug: "Memory leak",
        why: `\`${name}\` lives for the whole life of the process and ${fn ? `\`${fn}()\`` : "this code"} adds to it on every call, but nothing ever removes entries. Memory keeps rising until the server slows down or crashes.`,
        eli5: ELI5,
        fix: { startLine: j + 1, before: [line], after: [line, `${ind}${guard}`], note: `Caps ${name} at ${LIMIT} entries. An LRU cache works too.` },
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
    const decl = /^([A-Za-z_]\w*)\s*=\s*(\{\}|\[\]|dict\(\)|list\(\)|set\(\)|OrderedDict\(\))\s*(#.*)?$/.exec(text);
    if (!decl) return;
    const name = decl[1];
    const kind = decl[2].startsWith("[") || decl[2].startsWith("list") ? "list" : decl[2].startsWith("set") ? "set" : "dict";
    const evicts = new RegExp(`(?<![\\w.])${name}\\.(pop|popitem|clear|remove|discard)\\(|\\bdel\\s+${name}\\b|(?<![\\w.])${name}\\s*=(?!=)`);
    if (lines.some((l, j) => j !== i && evicts.test(l))) return;
    const mut = new RegExp(`(?<![\\w.])${name}(?:\\.(append|add|setdefault|insert)\\(|\\[[^\\]]+\\]\\s*=(?!=))`);
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (j === i || indentOf(line).length === 0 || isCommentLine(line, "python")) continue;
      if (!mut.test(line)) continue;
      const ind = indentOf(line);
      const evict =
        kind === "list" ? `${name}.pop(0)` : kind === "set" ? `${name}.pop()` : `${name}.pop(next(iter(${name})))`;
      const fn = enclosingFunctionName(lines, j, "python");
      out.push({
        kind: "leech",
        bug: "Memory leak",
        why: `\`${name}\` is a module-level ${kind} that ${fn ? `\`${fn}()\`` : "this code"} fills on every call and never empties. The process grows forever.`,
        eli5: ELI5,
        fix: { startLine: j + 1, before: [line], after: [line, `${ind}if len(${name}) > ${LIMIT}: ${evict}`], note: `Caps ${name} at ${LIMIT} entries. functools.lru_cache is another option.` },
        lineOffsets: [0],
      });
      return;
    }
  });
  return out;
}

export const memoryLeakRule: Rule = ({ lines, language }) => {
  if (isJsLike(language)) return jsRule(lines);
  if (language === "python") return pyRule(lines);
  return [];
};
