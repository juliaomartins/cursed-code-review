import type { Rule, RawFinding } from "./context";
import { isCommentLine, isJsLike, pickQuote } from "./util";

const SQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;

/** Calls that already make a value safe to put into HTML. */
const SAFE_HTML = /^(escapeHtml|escapeHTML|escape|htmlEscape|encodeHTML|sanitize|sanitizeHtml|purify|xss|encodeURIComponent|String\(Number)\s*\(|^(DOMPurify|he|_|validator|lodash)\.(sanitize|encode|escape)\s*\(|^\d+$|^['"][^'"]*['"]$/;

const ELI5_SQL =
  "A stranger whispers orders into your notebook, and the notebook obeys. We put their words in a locked box so they stay just words.";
const ELI5_XSS =
  "Someone hands you a sign to hang on your wall, and it secretly has instructions written on it. We read it out loud as plain words instead of following it.";

function placeholder(style: "dollar" | "qmark" | "pyformat", n: number): string {
  if (style === "dollar") return `$${n}`;
  if (style === "qmark") return "?";
  return "%s";
}

/** Replaces `'${expr}'` / `${expr}` (or `{expr}`) interpolations with bind placeholders. */
export function parameterize(
  body: string,
  open: "${" | "{" | "$",
  style: "dollar" | "qmark" | "pyformat",
): { sql: string; exprs: string[] } {
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

function sqlFinding(line: number, original: string, fixed: string, why: string, note?: string): RawFinding {
  return {
    kind: "possessor",
    bug: "SQL injection",
    why,
    eli5: ELI5_SQL,
    fix: { startLine: line, before: [original], after: [fixed], note },
    lineOffsets: [0],
  };
}

function jsRules(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, "javascript")) return;
    const n = i + 1;

    // SQL in a template literal with interpolation.
    const tpl = /`([^`]*)`/.exec(text);
    if (tpl && SQL.test(tpl[1]) && tpl[1].includes("${")) {
      const { sql, exprs } = parameterize(tpl[1], "${", "dollar");
      const q = pickQuote(sql, "'");
      const fixed = text.replace(tpl[0], `${q}${sql}${q}, [${exprs.join(", ")}]`);
      out.push(
        sqlFinding(
          n,
          text,
          fixed,
          `User input (${exprs.map((e) => `\`${e}\``).join(", ")}) is pasted straight into the SQL text. Anyone who controls it can type SQL of their own and take over the query.`,
        ),
      );
      return;
    }

    // SQL built with string concatenation: "SELECT ... " + expr
    const concat = /(["'])([^"']*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*?)\1\s*\+\s*([A-Za-z_$][\w$.]*(?:\[[^\]]+\])?)/i.exec(
      text,
    );
    if (concat) {
      const sql = `${concat[2]}$1`;
      const q = pickQuote(sql, "'");
      const fixed = text.replace(concat[0], `${q}${sql}${q}, [${concat[3]}]`);
      out.push(
        sqlFinding(
          n,
          text,
          fixed,
          `\`${concat[3]}\` is glued onto the end of the SQL string. If it comes from a user, they can end your query early and run their own.`,
        ),
      );
      return;
    }

    // DOM XSS.
    const html = /^(\s*)([\w$.[\]]+)\.(innerHTML|outerHTML)\s*=\s*(.+?);?\s*$/.exec(text);
    if (html) {
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
      out.push({
        kind: "possessor",
        bug: "Cross-site scripting (XSS)",
        why: `Data is written into the page as raw HTML through \`.${html[3]}\`. If it contains a <script> tag or an onerror handler, the browser runs it as code.`,
        eli5: ELI5_XSS,
        fix: { startLine: n, before: [text], after: [fixed], note },
        lineOffsets: [0],
      });
    }
  });
  return out;
}

function pythonRules(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, "python")) return;
    const n = i + 1;

    const fstr = /\bf(["'])(.*?)\1/.exec(text);
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
        ),
      );
      return;
    }

    const pct = /(["'])((?:(?!\1).)*%s(?:(?!\1).)*)\1\s*%\s*(\([^)]*\)|[\w.]+)/.exec(text);
    if (pct && SQL.test(pct[2])) {
      const sql = pct[2].replace(/'%s'/g, "%s");
      const params = pct[3].startsWith("(") ? pct[3] : `(${pct[3]},)`;
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(pct[0], `${pct[1]}${sql}${pct[1]}, ${params}`),
          "The `%` operator formats values into the SQL text before the database sees it, so a crafted value becomes part of the query.",
        ),
      );
      return;
    }

    const concat = /(["'])([^"']*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*?)\1\s*\+\s*(?:str\()?([\w.]+(?:\[[^\]]+\])?)\)?/i.exec(text);
    if (concat) {
      const sql = `${concat[2]}%s`;
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(concat[0], `${concat[1]}${sql}${concat[1]}, (${concat[3]},)`),
          `\`${concat[3]}\` is concatenated onto the SQL string, so whoever controls it controls the query.`,
        ),
      );
    }
  });
  return out;
}

function phpRules(lines: string[]): RawFinding[] {
  const out: RawFinding[] = [];
  lines.forEach((text, i) => {
    if (isCommentLine(text, "php")) return;
    const n = i + 1;

    const dq = /"([^"]*)"/.exec(text);
    if (dq && SQL.test(dq[1]) && /\$[A-Za-z_]/.test(dq[1])) {
      const { sql, exprs } = parameterize(dq[1], "$", "qmark");
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(dq[0], `"${sql}", [${exprs.join(", ")}]`),
          `PHP interpolates ${exprs.map((e) => `\`${e}\``).join(", ")} into the query string. A request can smuggle SQL through ${exprs.length === 1 ? "it" : "them"}.`,
          "Bind the values with a prepared statement ($pdo->prepare(...)->execute([...])).",
        ),
      );
      return;
    }

    const concat = /(["'])([^"']*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*?)\1\s*\.\s*(\$[\w]+(?:\[[^\]]+\])?)/i.exec(text);
    if (concat) {
      out.push(
        sqlFinding(
          n,
          text,
          text.replace(concat[0], `${concat[1]}${concat[2]}?${concat[1]}, [${concat[3]}]`),
          `\`${concat[3]}\` is concatenated into the SQL. Whoever controls it controls the query.`,
          "Bind the values with a prepared statement ($pdo->prepare(...)->execute([...])).",
        ),
      );
      return;
    }

    const echo = /^(\s*)echo\s+(\$_(?:GET|POST|REQUEST|COOKIE)\[[^\]]+\])\s*;/.exec(text);
    if (echo) {
      out.push({
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

export const injectionRule: Rule = ({ lines, language }) => {
  if (isJsLike(language)) return jsRules(lines);
  if (language === "python") return pythonRules(lines);
  return phpRules(lines);
};
