import type { Rule, RawFinding } from "./context";
import { indentWidth } from "./util";

const ELI5 = "You said goodbye and shut the door, then kept talking. Nobody hears it.";

const JS_TERM = /^\s*(return\b[^;{]*;|return;|throw\b.*;|break;|continue;|exit\(.*\);|die\(.*\);)\s*(\/\/.*)?$/;
const PY_TERM = /^\s*(return\b.*|raise\b.*|break|continue|sys\.exit\(.*\)|exit\(.*\))\s*(#.*)?$/;

export const deadCodeRule: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  const py = language === "python";
  for (let i = 0; i < lines.length; i++) {
    const text = code[i];
    const term = (py ? PY_TERM : JS_TERM).exec(text);
    if (!term) continue;
    if (py && /[([{,\\]\s*$/.test(text)) continue;
    const width = indentWidth(text);
    const dead: number[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      // Blank and comment-only lines are not code: they can sit inside the dead span but never make one.
      const t = code[j].trim();
      if (t === "") {
        dead.push(j);
        continue;
      }
      if (indentWidth(lines[j]) < width) break;
      if (!py && (/^[}\])]/.test(t) || /^(case\b|default\s*:|function\b)/.test(t))) break;
      if (py && /^(except|else|elif|finally)\b/.test(t)) break;
      dead.push(j);
    }
    while (dead.length && code[dead[dead.length - 1]].trim() === "") dead.pop();
    while (dead.length && code[dead[0]].trim() === "") dead.shift();
    if (!dead.length) continue;
    const start = dead[0];
    const before = lines.slice(start, dead[dead.length - 1] + 1);
    const keyword = term[1].split(/[\s;(]/)[0];
    const count = dead.filter((k) => code[k].trim() !== "").length;
    out.push({
      ruleId: "dead-code",
      kind: "zombie",
      bug: "Dead code",
      why: `${count === 1 ? "This line comes" : `These ${count} lines come`} after \`${keyword}\`, so ${count === 1 ? "it" : "they"} can never run. Dead code only confuses the next reader.`,
      eli5: ELI5,
      fix: { startLine: start + 1, before, after: [] },
      lineOffsets: [0],
      dimOffsets: before.map((_, k) => k),
    });
    i = j - 1;
  }
  return out;
};
