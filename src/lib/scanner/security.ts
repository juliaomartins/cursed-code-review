import type { Confidence } from "../types";
import type { Rule, RawFinding } from "./context";
import { hasCode, isCodeAt } from "./lexer";
import { UNTRUSTED } from "./rules";
import { isJsLike } from "./util";

const ELI5_CMD =
  'You let a stranger finish your sentence to the robot butler, and they added "…and open the safe". Give the butler a fixed list of chores instead.';
const ELI5_EVAL = "You read a note out loud and do whatever it says. If someone else wrote the note, they are in charge now.";
const ELI5_TLS = "You check the ID of whoever answers the phone. Turning it off means anyone can pretend to be your bank.";
const ELI5_JWT = "A ticket is only worth something if the stamp is checked. Without the check, anyone can print their own ticket.";

type Lang = "js" | "python" | "php";
const langKey = (l: string): Lang => (l === "python" ? "python" : l === "php" ? "php" : "js");

function evidenceOf(snippet: string, lang: Lang): { confidence: Confidence; exposure?: "untrusted-input" } {
  return UNTRUSTED[lang].test(snippet) ? { confidence: "high", exposure: "untrusted-input" } : { confidence: "medium" };
}

/** A finding with no automatic fix: the code stays as it is and the remediation is explained. */
function manual(
  ruleId: string,
  kind: RawFinding["kind"],
  bug: string,
  n: number,
  text: string,
  column: number,
  why: string,
  eli5: string,
  note: string,
  extra: Partial<RawFinding> = {},
): RawFinding {
  return {
    ruleId,
    kind,
    bug,
    why,
    eli5,
    autofix: false,
    column: column + 1,
    fix: { startLine: n, before: [text], after: [text], note },
    lineOffsets: [0],
    ...extra,
  };
}

/** The first match whose start is real code (not in a string or comment). */
function codeMatch(re: RegExp, text: string, masked: string, offset = 0): RegExpExecArray | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (let m = g.exec(text); m; m = g.exec(text)) if (isCodeAt(masked, text, m.index + offset)) return m;
  return null;
}

/** Command injection: a shell command built from a variable. */
const commandInjection: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  const lang = langKey(language);
  // JS: only when child_process is actually used, so `regex.exec(…)` and unrelated exec() never match.
  const usesChildProcess = isJsLike(language) && lines.some((l) => /['"](?:node:)?child_process['"]/.test(l));
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    let m: RegExpExecArray | null = null;
    let api = "";
    if (isJsLike(language)) {
      if (!usesChildProcess) return;
      m = codeMatch(
        /(?<![\w$.])(?:(?:child_process|cp)\.)?(execSync|exec)\s*\(\s*(`[^`]*\$\{[^`]*`|(["'])[^"']*\3\s*\+\s*[\w$.[\]]+|[A-Za-z_$][\w$.]*\s*[,)])/,
        text,
        masked,
      );
      if (m && /^[A-Za-z_$][\w$.]*\s*[,)]$/.test(m[2]) && !/^[a-z]/.test(m[2])) m = null; // CONSTANT_NAME
      api = m ? `${m[1]}()` : "";
      if (!m) {
        const spawn = codeMatch(/(?<![\w$.])(spawn|spawnSync|execFile)\s*\((.*)\bshell\s*:\s*true/, text, masked);
        if (spawn && /`[^`]*\$\{|\+\s*[\w$]/.test(spawn[2])) {
          m = spawn;
          api = `${spawn[1]}() with shell: true`;
        }
      }
    } else if (language === "python") {
      m = codeMatch(/(?<![\w.])(os\.system|os\.popen)\s*\(\s*(f["']|["'][^"']*["']\s*(?:%|\+|\.format)|[A-Za-z_]\w*\s*\))/, text, masked);
      api = m ? `${m[1]}()` : "";
      if (!m) {
        const sp = codeMatch(
          /(?<![\w.])(subprocess\.(?:run|call|Popen|check_output|check_call))\s*\(\s*(f["']|["'][^"']*["']\s*(?:%|\+|\.format)|[A-Za-z_]\w*\s*,)(.*)\bshell\s*=\s*True/,
          text,
          masked,
        );
        if (sp) {
          m = sp;
          api = `${sp[1]}(…, shell=True)`;
        }
      }
    } else {
      m = codeMatch(
        /(?<![\w>$])(exec|system|shell_exec|passthru|popen|proc_open)\s*\(\s*(?:"[^"]*\$[A-Za-z_][^"]*"|(?:["'][^"']*["']\s*\.\s*)?\$[A-Za-z_][\w[\]'"]*)/,
        text,
        masked,
      );
      api = m ? `${m[1]}()` : "";
    }
    if (!m) return;
    const ev = evidenceOf(text, lang);
    out.push(
      manual(
        "command-injection",
        "possessor",
        "OS command injection",
        i + 1,
        text,
        m.index,
        `A shell command is built from a variable and run with \`${api}\`. If any part of it comes from a user, characters like \`;\`, \`|\` or \`$(…)\` let them run their own commands.${ev.exposure ? " Request data reaches it on this line." : " The scanner cannot see where the value comes from."}`,
        ELI5_CMD,
        lang === "js"
          ? "No safe automatic fix: splitting a command into arguments depends on the program. Use execFile('program', [arg1, arg2]) or spawn without shell, and validate the input against an allow-list."
          : lang === "python"
            ? "No safe automatic fix. Use subprocess.run(['program', arg1, arg2]) without shell=True (or shlex.quote for a value that must go into a shell), and validate the input."
            : "No safe automatic fix. Wrap each value in escapeshellarg(), or avoid the shell entirely, and validate the input against an allow-list.",
        ev,
      ),
    );
  });
  return out;
};

/** Code injection: eval / new Function / exec on a non-literal. */
const codeInjection: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  const lang = langKey(language);
  const re =
    language === "python"
      ? /(?<![\w.])(eval|exec)\s*\(\s*(?!["'][^"']*["']\s*\))/
      : language === "php"
        ? /(?<![\w>$])(eval)\s*\(\s*(?=\$|["'][^"']*\$)/
        : /(?<![\w$.])(eval|new\s+Function)\s*\(\s*(?!["'`][^"'`$]*["'`]\s*\))/;
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    const m = codeMatch(re, text, masked);
    if (!m) return;
    // eval() with nothing inside is not code injection (and `model.eval()` never matched: calls on objects are excluded).
    if (
      text
        .slice(m.index + m[0].length)
        .trimStart()
        .startsWith(")")
    )
      return;
    const ev = evidenceOf(text, lang);
    out.push(
      manual(
        "code-injection",
        "possessor",
        "Code injection (eval)",
        i + 1,
        text,
        m.index,
        `\`${m[1].replace(/\s+/g, " ")}\` runs a string as code. If any part of that string can be influenced from outside, it runs with the full power of your program.${ev.exposure ? " Request data reaches it on this line." : ""}`,
        ELI5_EVAL,
        lang === "python"
          ? "No safe automatic fix. Parse data with json.loads or ast.literal_eval, and map allowed operations to functions instead of evaluating text."
          : "No safe automatic fix. Parse data with JSON.parse, and map allowed operations to functions instead of evaluating text.",
        ev,
      ),
    );
  });
  return out;
};

/** TLS certificate verification switched off. */
const tlsDisabled: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    let m: RegExpExecArray | null = null;
    let fixed = text;
    let what = "";
    if (isJsLike(language)) {
      m = codeMatch(/\brejectUnauthorized\s*:\s*false\b/, text, masked);
      if (m) {
        fixed = text.slice(0, m.index) + m[0].replace(/false$/, "true") + text.slice(m.index + m[0].length);
        what = "`rejectUnauthorized: false` accepts any certificate";
      } else {
        m = codeMatch(/\bNODE_TLS_REJECT_UNAUTHORIZED\b\s*=\s*(["'])0\1/, text, masked);
        if (m) {
          fixed = text.slice(0, m.index) + m[0].replace(/(["'])0\1$/, "$11$1") + text.slice(m.index + m[0].length);
          what = "`NODE_TLS_REJECT_UNAUTHORIZED = '0'` turns off certificate checks for every request in the process";
        }
      }
    } else if (language === "python") {
      if (!/\b(requests|httpx|session|client)\b|\.(get|post|put|patch|delete|request)\s*\(/i.test(masked)) return;
      m = codeMatch(/\bverify\s*=\s*False\b/, text, masked);
      if (m) {
        fixed = text.slice(0, m.index) + "verify=True" + text.slice(m.index + m[0].length);
        what = "`verify=False` accepts any certificate";
      }
    }
    if (!m) return;
    out.push({
      ruleId: "tls-verification-disabled",
      kind: "gremlin",
      bug: "TLS verification disabled",
      why: `${what}, so the connection can be intercepted by anyone on the network path, and credentials sent over it can be stolen.`,
      eli5: ELI5_TLS,
      column: m.index + 1,
      fix: {
        startLine: i + 1,
        before: [text],
        after: [fixed],
        note: "If the server uses a private or self-signed certificate, trust that certificate explicitly (ca option, or verify='/path/to/ca.pem') instead of turning checks off.",
      },
      lineOffsets: [0],
    });
  });
  return out;
};

/** JWT accepted without checking its signature. */
const jwtUnverified: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    let m: RegExpExecArray | null = null;
    let what = "";
    if (language === "python") {
      if (!/\bjwt\.decode\s*\(/.test(masked)) return;
      m = codeMatch(/\bverify\s*=\s*False\b|["']verify_signature["']\s*:\s*False\b/, text, masked);
      what = "`jwt.decode` is called with signature verification turned off";
    } else if (isJsLike(language)) {
      m = /\balgorithms\s*:\s*\[[^\]]*["']none["']/i.exec(text);
      if (m && !isCodeAt(masked, text, m.index)) m = null;
      what = "the accepted algorithms include `none`, which means unsigned tokens";
    }
    if (!m) return;
    out.push(
      manual(
        "jwt-verification-disabled",
        "gremlin",
        "JWT signature not verified",
        i + 1,
        text,
        m.index,
        `${what}. Anyone can write a token claiming to be any user, and this code will believe it.`,
        ELI5_JWT,
        "No safe automatic fix: verifying needs your key. Use jwt.verify(token, key, { algorithms: ['HS256'] }) in Node, or jwt.decode(token, key, algorithms=['HS256']) in PyJWT, with the algorithm you actually issue.",
        { confidence: "high" },
      ),
    );
  });
  return out;
};

export const securityRules: Rule[] = [commandInjection, codeInjection, tlsDisabled, jwtUnverified];
