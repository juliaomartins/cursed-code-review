import type { Confidence } from "../types";
import type { Rule, RawFinding } from "./context";
import { hasCode, isCodeAt, opensString } from "./lexer";
import { UNTRUSTED } from "./rules";
import { isJsLike, pickQuote } from "./util";

/**
 * A real statement shape, not just a keyword: SELECT … FROM, INSERT INTO, UPDATE … SET, DELETE FROM.
 * "Please select an option" or "Update available" do not match.
 */
const SQL = /\bSELECT\b[\s\S]*?\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[\w."`[\]]+\s+SET\b|\bDELETE\s+FROM\b/i;

/** Interpolated values that look like constants (TABLE, MAX_ROWS, 10) rather than data. */
const CONSTANT = /^(?:[A-Z][A-Z0-9_]*|\d+|this\.[A-Z][A-Z0-9_]*)$/;

type Lang = "js" | "python" | "php";

/** Confidence and exposure of an injection, from what is visible on the line only. */
function evidence(exprs: string[], lang: Lang): { confidence: Confidence; exposure?: "untrusted-input"; doubt?: string } {
  if (exprs.some((e) => UNTRUSTED[lang].test(e))) return { confidence: "high", exposure: "untrusted-input" };
  if (exprs.length && exprs.every((e) => CONSTANT.test(e.trim())))
    return {
      confidence: "low",
      doubt:
        " Only constant-looking values are interpolated here, so this may be safe; the scanner cannot see where they come from. Bind them anyway, or allow-list identifiers such as table names.",
    };
  return { confidence: "high" };
}

/** Calls that already make a value safe to put into HTML. */
const SAFE_HTML =
  /^(escapeHtml|escapeHTML|escape|htmlEscape|encodeHTML|sanitize|sanitizeHtml|purify|xss|encodeURIComponent|String\(Number)\s*\(|^(DOMPurify|he|_|validator|lodash)\.(sanitize|encode|escape)\s*\(|^\d+$|^['"][^'"]*['"]$/;

const ELI5_SQL = "A stranger whispers orders into your notebook, and the notebook obeys. We put their words in a locked box so they stay just words.";
const ELI5_XSS =
  "Someone hands you a sign to hang on your wall, and it secretly has instructions written on it. We read it out loud as plain words instead of following it.";

function placeholder(style: "dollar" | "qmark" | "pyformat", n: number): string {
  if (style === "dollar") return `$${n}`;
  if (style === "qmark") return "?";
  return "%s";
}

/** Replaces `'${expr}'` / `${expr}` (or `{expr}`) interpolations with bind placeholders. */
export function parameterize(body: string, open: "${" | "{" | "$", style: "dollar" | "qmark" | "pyformat"): { sql: string; exprs: string[] } {
  const exprs: string[] = [];
  let re: RegExp;
  if (open === "${") re = /(['"]?)\$\{([^}]+)\}\1/g;
  else if (open === "{") re = /(['"]?)\{([^}]+)\}\1/g;
  else re = /(['"]?)\{?(\$[A-Za-z_]\w*(?:\[[^\]]*\]|->\w+)*)\}?\1/g;
  const sql = body.replace(re, (_m, _q, expr: string) => {
    exprs.push(expr.trim());
    return placeholder(style, exprs.length);
  });
  return { sql, exprs };
}

function sqlFinding(line: number, original: string, fixed: string, why: string, ev: ReturnType<typeof evidence>, column: number, note?: string): RawFinding {
  return {
    ruleId: "sql-injection",
    kind: "possessor",
    bug: "SQL injection",
    why: why + (ev.doubt ?? ""),
    eli5: ELI5_SQL,
    fix: { startLine: line, before: [original], after: [fixed], note },
    lineOffsets: [0],
    confidence: ev.confidence,
    exposure: ev.exposure,
    column: column + 1,
  };
}

/** The first match of `re` in `text` whose opening quote is real code (not inside a comment). */
function stringMatch(re: RegExp, text: string, masked: string, quoteOffset = 0): RegExpExecArray | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (let m = g.exec(text); m; m = g.exec(text)) if (opensString(masked, text, m.index + quoteOffset)) return m;
  return null;
}

function jsRules(lines: string[], code: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    const n = i + 1;

    // SQL in a template literal with interpolation.
    const tpl = stringMatch(/`([^`]*)`/, text, masked);
    if (tpl && SQL.test(tpl[1]) && tpl[1].includes("${")) {
      const { sql, exprs } = parameterize(tpl[1], "${", "dollar");
      const q = pickQuote(sql, "'");
      const fixed = text.replace(tpl[0], `${q}${sql}${q}, [${exprs.join(", ")}]`);
      out.push(
        sqlFinding(
          n,
          text,
          fixed,
          `${exprs.map((e) => `\`${e}\``).join(", ")} ${exprs.length === 1 ? "is" : "are"} pasted straight into the SQL text. Anyone who controls ${exprs.length === 1 ? "it" : "them"} can type SQL of their own and take over the query.`,
          evidence(exprs, "js"),
          tpl.index,
        ),
      );
      return;
    }

    // SQL built with string concatenation: "SELECT ... " + expr
    const concat = stringMatch(/(["'])([^"']*?)\1\s*\+\s*([A-Za-z_$][\w$.]*(?:\[[^\]]+\])?)/, text, masked);
    if (concat && SQL.test(concat[2])) {
      const sql = `${concat[2]}$1`;
      const q = pickQuote(sql, "'");
      const fixed = text.replace(concat[0], `${q}${sql}${q}, [${concat[3]}]`);
      out.push(
        sqlFinding(
          n,
          text,
          fixed,
          `\`${concat[3]}\` is glued onto the end of the SQL string. If it comes from a user, they can end your query early and run their own.`,
          evidence([concat[3]], "js"),
          concat.index,
        ),
      );
      return;
    }

    // DOM XSS.
    const html = /^(\s*)([\w$.[\]]+)\.(innerHTML|outerHTML)\s*=\s*(.+?);?\s*$/.exec(text);
    if (html && isCodeAt(masked, text, text.indexOf("." + html[3]) + 1)) {
      const rhs = html[4];
      const isPlainLiteral = /^(['"])[^'"]*\1$/.test(rhs) || (/^`[^`$]*`$/.test(rhs) && !rhs.includes("${"));
      if (isPlainLiteral) return;
      let fixed: string;
      let note: string | undefined;
      if (/^`.*`$/.test(rhs)) {
        // Only wrap the interpolations that aren't escaped already; if all are, the line is safe.
        const unsafe = [...rhs.matchAll(/\$\{([^}]+)\}/g)].filter((m) => !SAFE_HTML.test(m[1].trim()));
        if (!unsafe.length) return;
        const escaped = rhs.replace(/\$\{([^}]+)\}/g, (m, e: string) => (SAFE_HTML.test(e.trim()) ? m : `\${escapeHtml(${e.trim()})}`));
        fixed = `${html[1]}${html[2]}.${html[3]} = ${escaped};`;
        note = "Uses an escapeHtml() helper, e.g. the `escape-html` package.";
      } else {
        if (SAFE_HTML.test(rhs.trim())) return;
        fixed = `${html[1]}${html[2]}.textContent = ${rhs};`;
      }
      const ev = evidence([rhs], "js");
      out.push({
        ruleId: "xss",
        kind: "possessor",
        bug: "Cross-site scripting (XSS)",
        why: `Data is written into the page as raw HTML through \`.${html[3]}\`. If it contains a <script> tag or an onerror handler, the browser runs it as code.`,
        eli5: ELI5_XSS,
        fix: { startLine: n, before: [text], after: [fixed], note },
        lineOffsets: [0],
        confidence: ev.exposure ? "high" : "medium",
        exposure: ev.exposure,
        column: text.indexOf("." + html[3]) + 2,
      });
    }
  });
  return out;
}

function pythonRules(lines: string[], code: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    const n = i + 1;

    const fstr = stringMatch(/\bf(["'])(.*?)\1/, text, masked, 1);
    if (fstr && SQL.test(fstr[2]) && fstr[2].includes("{")) {
      const { sql, exprs } = parameterize(fstr[2], "{", "pyformat");
      const q = pickQuote(sql, '"');
      const params = exprs.length === 1 ? `(${exprs[0]},)` : `(${exprs.join(", ")})`;
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(fstr[0], `${q}${sql}${q}, ${params}`),
          `The f-string drops ${exprs.map((e) => `\`${e}\``).join(", ")} straight into the SQL. Anyone who controls ${exprs.length === 1 ? "it" : "them"} can rewrite the query.`,
          evidence(exprs, "python"),
          text.indexOf(fstr[0]),
        ),
      );
      return;
    }

    const pct = stringMatch(/(["'])((?:(?!\1).)*%s(?:(?!\1).)*)\1\s*%\s*(\([^)]*\)|[\w.]+)/, text, masked);
    if (pct && SQL.test(pct[2])) {
      const sql = pct[2].replace(/'%s'/g, "%s");
      const params = pct[3].startsWith("(") ? pct[3] : `(${pct[3]},)`;
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(pct[0], `${pct[1]}${sql}${pct[1]}, ${params}`),
          "The `%` operator formats values into the SQL text before the database sees it, so a crafted value becomes part of the query.",
          evidence([pct[3]], "python"),
          pct.index,
        ),
      );
      return;
    }

    const concat = stringMatch(/(["'])([^"']*?)\1\s*\+\s*(?:str\()?([\w.]+(?:\[[^\]]+\])?)\)?/, text, masked);
    if (concat && SQL.test(concat[2])) {
      const sql = `${concat[2]}%s`;
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(concat[0], `${concat[1]}${sql}${concat[1]}, (${concat[3]},)`),
          `\`${concat[3]}\` is concatenated onto the SQL string, so whoever controls it controls the query.`,
          evidence([concat[3]], "python"),
          concat.index,
        ),
      );
    }
  });
  return out;
}

function phpRules(lines: string[], code: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    const masked = code[i];
    if (!hasCode(masked)) return;
    const n = i + 1;

    const dq = stringMatch(/"([^"]*)"/, text, masked);
    if (dq && SQL.test(dq[1]) && /\$[A-Za-z_]/.test(dq[1])) {
      const { sql, exprs } = parameterize(dq[1], "$", "qmark");
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(dq[0], `"${sql}", [${exprs.join(", ")}]`),
          `PHP interpolates ${exprs.map((e) => `\`${e}\``).join(", ")} into the query string. A request can smuggle SQL through ${exprs.length === 1 ? "it" : "them"}.`,
          evidence(exprs, "php"),
          dq.index,
          "Bind the values with a prepared statement ($pdo->prepare(...)->execute([...])).",
        ),
      );
      return;
    }

    const concat = stringMatch(/(["'])([^"']*?)\1\s*\.\s*(\$[\w]+(?:\[[^\]]+\])?)/, text, masked);
    if (concat && SQL.test(concat[2])) {
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(concat[0], `${concat[1]}${concat[2]}?${concat[1]}, [${concat[3]}]`),
          `\`${concat[3]}\` is concatenated into the SQL. Whoever controls it controls the query.`,
          evidence([concat[3]], "php"),
          concat.index,
          "Bind the values with a prepared statement ($pdo->prepare(...)->execute([...])).",
        ),
      );
      return;
    }

    const echo = /^(\s*)echo\s+(\$_(?:GET|POST|REQUEST|COOKIE)\[[^\]]+\])\s*;/.exec(text);
    if (echo && isCodeAt(masked, text, echo[1].length)) {
      out.push({
        ruleId: "xss",
        confidence: "high",
        exposure: "untrusted-input",
        column: echo[1].length + 1,
        kind: "possessor",
        bug: "Cross-site scripting (XSS)",
        why: `\`${echo[2]}\` comes straight from the request and is printed as raw HTML. A link can carry a script that runs in your visitor's browser.`,
        eli5: ELI5_XSS,
        fix: { startLine: n, before: [text], after: [`${echo[1]}echo htmlspecialchars(${echo[2]}, ENT_QUOTES, 'UTF-8');`] },
        lineOffsets: [0],
      });
    }
  });
  return out;
}

export const injectionRule: Rule = ({ lines, code, language }) => {
  if (isJsLike(language)) return jsRules(lines, code);
  if (language === "python") return pythonRules(lines, code);
  return phpRules(lines, code);
};
