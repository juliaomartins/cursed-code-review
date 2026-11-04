import type { Rule, RawFinding } from "./context";
import { isCommentLine, isJsLike, toUpperSnake } from "./util";

const SECRET_NAME = /(api[_-]?key|secret|token|passw(?:or)?d|pwd|private[_-]?key|access[_-]?key|client[_-]?secret|auth)/i;
const SECRET_VALUE = /^(sk[-_](?:live|test)[-_]|AKIA[0-9A-Z]{8,}|ghp_[A-Za-z0-9]{8,}|xox[bpa]-|-----BEGIN)/;
const PLACEHOLDER = /^(\$\{|<|your[-_ ]|changeme$|example$|\*+$|todo$)/i;

const ASSIGN = /(?:\$)?(["']?)([A-Za-z_][\w-]*)\1(?:\s*:\s*[A-Za-z_][\w<>[\]|]*)?\s*(=>|=|:)\s*(["'`])((?:(?!\4).){6,})\4/;

export const secretsRule: Rule = ({ lines, language }) => {
  const out: RawFinding[] = [];
  const hasOsImport = lines.some((l) => /^\s*(import os\b|from os import)/.test(l));
  lines.forEach((text, i) => {
    if (isCommentLine(text, language)) return;
    const m = ASSIGN.exec(text);
    if (!m) return;
    const [, , name, , , value] = m;
    if (PLACEHOLDER.test(value) || value.includes("${")) return;
    if (!SECRET_VALUE.test(value) && !SECRET_NAME.test(name)) return;
    const env = toUpperSnake(name);
    const literal = m[0].slice(m[0].length - (value.length + 2));
    let expr: string;
    let note: string | undefined;
    if (isJsLike(language)) expr = `process.env.${env}`;
    else if (language === "python") {
      expr = `os.environ["${env}"]`;
      if (!hasOsImport) note = "Add `import os` at the top of the file.";
    } else expr = `getenv('${env}')`;
    const fixed = text.replace(literal, expr);
    if (fixed === text) return;
    const masked = value.length > 8 ? `${value.slice(0, 4)}…` : "…";
    out.push({
      kind: "gremlin",
      bug: "Hardcoded secret",
      why: `\`${name}\` holds a secret written directly in the code ("${masked}"). Anyone who can read the repo, its history or a leaked build can copy it and use your account.`,
      eli5: "You wrote your house key code on the front door. Anyone walking past can copy it. Keep it in a safe instead.",
      fix: {
        startLine: i + 1,
        before: [text],
        after: [fixed],
        note: note ?? `Set ${env} in your environment or secret manager, then rotate the leaked value.`,
      },
      lineOffsets: [0],
    });
  });
  return out;
};
