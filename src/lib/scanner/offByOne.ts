import type { Rule, RawFinding } from "./context";
import { isCommentLine } from "./util";

const ELI5 = "You have 5 cookies but reach for cookie number 6. There is no cookie 6!";

function finding(n: number, before: string, after: string, why: string): RawFinding {
  return { kind: "imp", bug: "Off-by-one", why, eli5: ELI5, fix: { startLine: n, before: [before], after: [after] }, lineOffsets: [0] };
}

export const offByOneRule: Rule = ({ lines, language }) => {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, language)) return;
    const n = i + 1;
    if (language === "python") {
      const rng = /range\(\s*(?:([^,()]+),\s*)?len\(([^()]+)\)\s*\+\s*1\s*\)/.exec(text);
      if (rng) {
        const fixed = text.replace(rng[0], `range(${rng[1] ? `${rng[1].trim()}, ` : ""}len(${rng[2]}))`);
        out.push(finding(n, text, fixed, `\`range(len(${rng[2]}) + 1)\` goes one step past the last index, so the final pass raises IndexError.`));
        return;
      }
      const idx = /\[\s*len\(([^()]+)\)\s*\]/.exec(text);
      if (idx) {
        out.push(
          finding(n, text, text.replace(idx[0], `[len(${idx[1]}) - 1]`), `Indexes run from 0 to len - 1, so \`[len(${idx[1]})]\` is always one past the end.`),
        );
      }
      return;
    }
    const loop = /(\bfor\s*\(([^;]*);\s*[\w$]+\s*)<=(\s*(?:[\w$.]+\.length|count\(\s*\$?\w+\s*\)|strlen\(\s*\$?\w+\s*\)))/.exec(text);
    // A loop that starts at 1 (or any positive number) may rightly run to <= length.
    const startsPositive = loop && /=\s*[1-9]\d*\s*$/.test(loop[2]);
    if (loop && !startsPositive) {
      const bound = loop[3].trim();
      out.push(
        finding(
          n,
          text,
          text.replace(loop[0], `${loop[1]}<${loop[3]}`),
          `The loop uses \`<=\` against \`${bound}\`, so it runs one step too far and reads past the end of the list.`,
        ),
      );
      return;
    }
    const idx = /\[\s*([\w$.]+)\.length\s*\]/.exec(text);
    if (idx) {
      out.push(
        finding(
          n,
          text,
          text.replace(idx[0], `[${idx[1]}.length - 1]`),
          `Indexes run from 0 to length - 1, so \`[${idx[1]}.length]\` is always undefined.`,
        ),
      );
    }
  });
  return out;
};
