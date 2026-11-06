import type { Confidence, Severity } from "../types";
import type { Rule, RawFinding } from "./context";
import { hasCode, opensString } from "./lexer";
import { isJsLike, toUpperSnake } from "./util";

/** Well-known credential formats. `live` ones grant real access and are CRITICAL. */
const KNOWN: { re: RegExp; label: string; live: boolean }[] = [
  { re: /^sk[-_]live[-_][A-Za-z0-9]{8,}/, label: "a Stripe live key", live: true },
  { re: /^sk[-_]test[-_][A-Za-z0-9]{8,}/, label: "a Stripe test key", live: false },
  { re: /^AKIA[0-9A-Z]{16}$/, label: "an AWS access key id", live: true },
  { re: /^gh[pousr]_[A-Za-z0-9]{20,}/, label: "a GitHub token", live: true },
  { re: /^github_pat_[A-Za-z0-9_]{20,}/, label: "a GitHub token", live: true },
  { re: /^xox[bpas]-[A-Za-z0-9-]{10,}/, label: "a Slack token", live: true },
  { re: /^AIza[0-9A-Za-z_-]{30,}/, label: "a Google API key", live: true },
  { re: /^-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, label: "a private key", live: true },
];

/** Words that make a name a credential when they appear in it. */
const SECRET_WORDS = new Set([
  "secret",
  "token",
  "password",
  "passwd",
  "pwd",
  "apikey",
  "credential",
  "credentials",
  "privatekey",
  "accesskey",
  "clientsecret",
]);
/** A name ending in one of these describes a credential (its label, type, field…), it isn't one. */
const DESCRIPTIVE = new Set([
  "label",
  "type",
  "name",
  "field",
  "url",
  "uri",
  "endpoint",
  "header",
  "placeholder",
  "hint",
  "message",
  "msg",
  "text",
  "length",
  "count",
  "expires",
  "expiry",
  "ttl",
  "path",
  "id",
  "hash",
  "prefix",
  "regex",
  "pattern",
  "policy",
  "min",
  "max",
  "input",
  "error",
]);

const PLACEHOLDER =
  /^(\$\{|<|\{\{|%\(|your[-_ ]|changeme$|change[-_]me|example|dummy|placeholder|redacted|xxx+|\*+$|todo$|test$|secret$|password$|none$|null$)/i;

const ASSIGN = /(?:\$)?(["']?)([A-Za-z_][\w-]*)\1(?:\s*:\s*[A-Za-z_][\w<>[\]|]*)?\s*(=>|=|:)\s*(["'`])((?:(?!\4).){6,})\4/g;

/** apiKey → ["api", "key"], DB_PASSWORD → ["db", "password"]. */
export function nameWords(name: string): string[] {
  return name
    .replace(/^\$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** A name that holds a credential: it contains a secret word (or pair like api+key) and doesn't just describe one. */
export function isSecretName(name: string): boolean {
  const words = nameWords(name);
  if (!words.length || DESCRIPTIVE.has(words[words.length - 1])) return false;
  const pairs = words.slice(1).map((w, i) => words[i] + w);
  return [...words, ...pairs].some((w) => SECRET_WORDS.has(w));
}

/** Shannon entropy in bits per character. */
export function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) h -= (c / s.length) * Math.log2(c / s.length);
  return h;
}

/** A value shaped like a credential: no spaces, long enough, and not plain words. */
function looksLikeCredential(value: string): boolean {
  if (/\s/.test(value) || value.length < 8) return false;
  if (/^https?:\/\/[^@]*$/.test(value)) return false; // a URL without embedded credentials
  // Words like "bearer" or "read-write" (letters only, low entropy). A random letter string still counts.
  if (/^[a-z]+(?:[-_][a-z]+)*$/i.test(value) && entropy(value) < 3.3) return false;
  return entropy(value) >= 3 || (/[A-Za-z]/.test(value) && /\d/.test(value));
}

export const secretsRule: Rule = ({ lines, code, language }) => {
  const out: RawFinding[] = [];
  const hasOsImport = lines.some((l) => /^\s*(import os\b|from os import)/.test(l));
  lines.forEach((text, i) => {
    if (!hasCode(code[i])) return;
    for (const m of text.matchAll(ASSIGN)) {
      const [whole, , name, , quote, value] = m;
      const quoteAt = (m.index ?? 0) + whole.length - value.length - 2;
      if (!opensString(code[i], text, quoteAt) || (quote === "`" && value.includes("${"))) continue;
      if (PLACEHOLDER.test(value)) continue;
      const known = KNOWN.find((k) => k.re.test(value));
      if (!known && !(isSecretName(name) && looksLikeCredential(value))) continue;

      const env = toUpperSnake(name);
      const literal = text.slice(quoteAt, quoteAt + value.length + 2);
      let expr: string;
      let note: string | undefined;
      if (isJsLike(language)) expr = `process.env.${env}`;
      else if (language === "python") {
        expr = `os.environ["${env}"]`;
        if (!hasOsImport) note = "Add `import os` at the top of the file.";
      } else expr = `getenv('${env}')`;
      const fixed = text.slice(0, quoteAt) + expr + text.slice(quoteAt + literal.length);
      if (fixed === text) continue;
      const masked = value.length > 8 ? `${value.slice(0, 4)}…` : "…";
      const severity: Severity = known?.live ? "CRITICAL" : "HIGH";
      const confidence: Confidence = known ? "high" : "medium";
      out.push({
        ruleId: "hardcoded-secret",
        kind: "gremlin",
        bug: "Hardcoded secret",
        severity,
        confidence,
        column: quoteAt + 1,
        why: known
          ? `\`${name}\` holds ${known.label} written directly in the code ("${masked}"). Anyone who can read the repo, its history or a leaked build can copy it and use your account.`
          : `\`${name}\` holds what looks like a credential ("${masked}", no spaces, high entropy). If it is real, anyone who can read the repo or its history can use it.`,
        eli5: "You wrote your house key code on the front door. Anyone walking past can copy it. Keep it in a safe instead.",
        fix: {
          startLine: i + 1,
          before: [text],
          after: [fixed],
          note: note ?? `Set ${env} in your environment or secret manager, then rotate the leaked value.`,
        },
        lineOffsets: [0],
      });
      return;
    }
  });
  return out;
};

/** Secret values on a line, for redacting reports and patches. */
export function secretValues(line: string): string[] {
  const found: string[] = [];
  for (const m of line.matchAll(ASSIGN)) {
    const [, , name, , , value] = m;
    if (PLACEHOLDER.test(value)) continue;
    if (KNOWN.some((k) => k.re.test(value)) || (isSecretName(name) && looksLikeCredential(value))) found.push(value);
  }
  for (const k of KNOWN) {
    const loose = new RegExp(k.re.source.replace(/^\^/, "").replace(/\$$/, ""), "g");
    for (const m of line.matchAll(loose)) if (!found.includes(m[0])) found.push(m[0]);
  }
  return found;
}
