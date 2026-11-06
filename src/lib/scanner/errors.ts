import type { Rule, RawFinding } from "./context";
import { hasCode } from "./lexer";

const ELI5 = "The smoke alarm went off and you took out the battery. The fire is still there; you just can't hear it.";

/**
 * Swallowed errors: an empty catch block (JS/TS/PHP), or a bare / catch-all `except` whose only body is
 * `pass` (Python). Catching a specific exception and passing (except KeyError: pass) is a deliberate
 * choice and is not reported.
 */
export const swallowedErrorRule: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  const py = language === "python";
  for (let i = 0; i < lines.length; i++) {
    const masked = code[i];
    if (!hasCode(masked)) continue;
    let span = 0;
    let what = "";
    if (py) {
      const ex = /^\s*except\s*(?:\(?\s*(Exception|BaseException)\s*\)?(?:\s+as\s+\w+)?)?\s*:\s*(pass)?\s*$/.exec(masked);
      if (!ex) continue;
      if (ex[2]) span = 0;
      else {
        let j = i + 1;
        while (j < lines.length && !hasCode(code[j])) j++;
        if (j >= lines.length || !/^\s*pass\s*$/.test(code[j])) continue;
        let k = j + 1;
        while (k < lines.length && !hasCode(code[k])) k++;
        const bodyIndent = /^\s*/.exec(lines[j])![0].length;
        if (k < lines.length && /^\s*/.exec(lines[k])![0].length >= bodyIndent) continue; // more statements follow
        span = j - i;
      }
      what = ex[1] ? `\`except ${ex[1]}: pass\` catches every error` : "A bare `except: pass` catches every error, even KeyboardInterrupt and SystemExit,";
    } else {
      const c = /\bcatch\s*(?:\([^)]*\))?\s*\{/.exec(masked);
      if (!c) continue;
      const rest = masked.slice(c.index + c[0].length);
      if (/^\s*\}/.test(rest)) span = 0;
      else if (rest.trim() === "") {
        let j = i + 1;
        while (j < lines.length && !hasCode(code[j])) j++;
        if (j >= lines.length || !/^\s*\}/.test(code[j])) continue;
        span = j - i;
      } else continue;
      what = "This `catch` block is empty: it catches the error";
    }
    out.push({
      ruleId: "swallowed-error",
      kind: "zombie",
      bug: "Swallowed error",
      severity: "MED",
      why: `${what} and does nothing with it. The failure disappears without a log line, and the code after it carries on as if everything worked.`,
      eli5: ELI5,
      autofix: false,
      column: (/\S/.exec(lines[i])?.index ?? 0) + 1,
      fix: {
        startLine: i + 1,
        before: lines.slice(i, i + span + 1),
        after: lines.slice(i, i + span + 1),
        note: "No safe automatic fix: only you know what should happen on failure. Log it with context, recover (retry, fallback, user message), or let it propagate; catch only the errors you expect.",
      },
      lineOffsets: [0],
    });
    i += span;
  }
  return out;
};
