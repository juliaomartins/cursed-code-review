import type { Category, Confidence, Finding, MonsterKind } from "../types";

export interface RuleMeta {
  id: string;
  title: string;
  kind: MonsterKind;
  category: Category;
  /** CWE id, e.g. 89. */
  cwe: number;
  /** OWASP Top 10 (2021) entry, when one applies. */
  owasp?: string;
  confidence: Confidence;
  /** What can go wrong in the running application. */
  impact: string;
  /** What the developer should do, in general terms (the finding's own fix is specific). */
  remediation: string;
  /** False when the rule never produces an automatic fix. */
  autofix: boolean;
  languages: string[];
}

const ALL = ["javascript", "typescript", "python", "php"];
const JS_PY = ["javascript", "typescript", "python"];

/** Every rule the scanner runs. Supported languages are the ones the tests cover. */
export const RULES_META: Record<string, RuleMeta> = {
  "sql-injection": {
    id: "sql-injection",
    title: "SQL injection",
    kind: "possessor",
    category: "Security",
    cwe: 89,
    owasp: "A03:2021 Injection",
    confidence: "high",
    impact:
      "An attacker who controls the value can read, change or delete any data the database user can reach, and sometimes run commands on the database server.",
    remediation: "Pass values as bound parameters (placeholders) instead of building the SQL text. Never interpolate or concatenate request data into a query.",
    autofix: true,
    languages: ALL,
  },
  xss: {
    id: "xss",
    title: "Cross-site scripting (XSS)",
    kind: "possessor",
    category: "Security",
    cwe: 79,
    owasp: "A03:2021 Injection",
    confidence: "high",
    impact: "Script injected into the page runs as your user: it can steal session tokens, read what they see and act on their behalf.",
    remediation: "Write text with textContent (or the framework's escaping), escape values that must go into HTML, and sanitise HTML you must render.",
    autofix: true,
    languages: ["javascript", "typescript", "php"],
  },
  "command-injection": {
    id: "command-injection",
    title: "OS command injection",
    kind: "possessor",
    category: "Security",
    cwe: 78,
    owasp: "A03:2021 Injection",
    confidence: "high",
    impact: "Shell metacharacters in the value (; | && $()) let an attacker run any command with the server's permissions.",
    remediation:
      "Do not build shell command strings. Call the program directly with an argument list (execFile/spawn without shell, subprocess.run([...]) without shell=True, escapeshellarg in PHP) and validate the input against an allow-list.",
    autofix: false,
    languages: ALL,
  },
  "code-injection": {
    id: "code-injection",
    title: "Code injection (eval)",
    kind: "possessor",
    category: "Security",
    cwe: 95,
    owasp: "A03:2021 Injection",
    confidence: "medium",
    impact: "Whatever string reaches eval runs as code inside your process, with full access to its data and secrets.",
    remediation: "Remove eval / new Function / exec. Parse data with JSON.parse or ast.literal_eval, and dispatch on an allow-list of known operations.",
    autofix: false,
    languages: ALL,
  },
  "hardcoded-secret": {
    id: "hardcoded-secret",
    title: "Hardcoded secret",
    kind: "gremlin",
    category: "Security",
    cwe: 798,
    owasp: "A07:2021 Identification and Authentication Failures",
    confidence: "medium",
    impact: "Anyone with access to the source, its git history, a build artefact or a log can use the credential.",
    remediation:
      "Load the value from the environment or a secret manager, and rotate the exposed credential: removing it from the code does not remove it from history.",
    autofix: true,
    languages: ALL,
  },
  "tls-verification-disabled": {
    id: "tls-verification-disabled",
    title: "TLS certificate verification disabled",
    kind: "gremlin",
    category: "Security",
    cwe: 295,
    owasp: "A02:2021 Cryptographic Failures",
    confidence: "high",
    impact: "Anyone on the network path can impersonate the server and read or change the traffic, including credentials.",
    remediation: "Keep verification on. For a private or self-signed certificate, trust that certificate explicitly (ca option, or verify='/path/to/ca.pem').",
    autofix: true,
    languages: JS_PY,
  },
  "jwt-verification-disabled": {
    id: "jwt-verification-disabled",
    title: "JWT signature not verified",
    kind: "gremlin",
    category: "Security",
    cwe: 347,
    owasp: "A07:2021 Identification and Authentication Failures",
    confidence: "high",
    impact: "Anyone can forge a token with any claims (user id, role) and the application will trust it.",
    remediation:
      "Verify the signature with the expected key and an explicit algorithm list (jwt.verify(token, key, { algorithms: ['HS256'] }) / jwt.decode(token, key, algorithms=['HS256'])). Never accept alg 'none'.",
    autofix: false,
    languages: JS_PY,
  },
  "null-access": {
    id: "null-access",
    title: "Possible null access",
    kind: "wraith",
    category: "Correctness",
    cwe: 476,
    confidence: "medium",
    impact: "When the lookup finds nothing, the next property read throws (TypeError / AttributeError) and the request or job fails.",
    remediation: "Check for null/undefined/None before using the value, or use optional chaining and decide what should happen when it is missing.",
    autofix: true,
    languages: JS_PY,
  },
  "off-by-one": {
    id: "off-by-one",
    title: "Off-by-one",
    kind: "imp",
    category: "Correctness",
    cwe: 193,
    confidence: "high",
    impact: "The last iteration reads past the end: undefined values in JavaScript, IndexError in Python, warnings in PHP.",
    remediation: "Loop with < length (or range(len(x))) and index the last element with length - 1.",
    autofix: true,
    languages: ALL,
  },
  "race-condition": {
    id: "race-condition",
    title: "Read-modify-write race",
    kind: "twins",
    category: "Correctness",
    cwe: 362,
    confidence: "medium",
    impact: "Two concurrent requests read the same old value and both write; one update is lost (balances, counters, stock).",
    remediation:
      "Make the read and the write one atomic step: a database transaction with row locking, an atomic update, or a lock around the critical section.",
    autofix: true,
    languages: JS_PY,
  },
  "swallowed-error": {
    id: "swallowed-error",
    title: "Swallowed error",
    kind: "zombie",
    category: "Correctness",
    cwe: 390,
    confidence: "high",
    impact: "Failures disappear without a trace: the code carries on with missing data and the real cause is never logged.",
    remediation: "Handle the error (retry, fallback, user message), log it with context, or let it propagate. Catch only the errors you expect.",
    autofix: false,
    languages: ALL,
  },
  "memory-leak": {
    id: "memory-leak",
    title: "Unbounded cache",
    kind: "leech",
    category: "Performance",
    cwe: 401,
    confidence: "medium",
    impact: "Memory grows with every call for the life of the process until it slows down or is killed.",
    remediation: "Bound the collection (size cap, LRU, TTL) or scope it to the request.",
    autofix: true,
    languages: JS_PY,
  },
  "dead-code": {
    id: "dead-code",
    title: "Unreachable code",
    kind: "zombie",
    category: "Maintainability",
    cwe: 561,
    confidence: "high",
    impact: "The code never runs. Readers may believe it does, and a fix placed there has no effect.",
    remediation: "Delete it, or move it before the return/throw if it was meant to run.",
    autofix: true,
    languages: ALL,
  },
};

/** Rule ids for findings saved before rule ids existed (one rule per monster then, except the Possessor). */
const LEGACY: Record<MonsterKind, string> = {
  possessor: "sql-injection",
  gremlin: "hardcoded-secret",
  wraith: "null-access",
  imp: "off-by-one",
  twins: "race-condition",
  zombie: "dead-code",
  leech: "memory-leak",
};

export function ruleOf(f: Pick<Finding, "ruleId" | "kind" | "bug">): RuleMeta {
  if (f.ruleId && RULES_META[f.ruleId]) return RULES_META[f.ruleId];
  if (f.kind === "possessor" && /XSS|scripting/i.test(f.bug)) return RULES_META.xss;
  return RULES_META[LEGACY[f.kind]];
}

export const cweUrl = (cwe: number) => `https://cwe.mitre.org/data/definitions/${cwe}.html`;

/** Full metadata for a finding, tolerant of findings saved by older versions. */
export function findingMeta(f: Finding) {
  const rule = ruleOf(f);
  return {
    rule,
    ruleId: rule.id,
    category: f.category ?? rule.category,
    confidence: f.confidence ?? rule.confidence,
    autofix: f.autofix ?? rule.autofix,
    references: [{ label: `CWE-${rule.cwe}`, url: cweUrl(rule.cwe) }, ...(rule.owasp ? [{ label: rule.owasp, url: "https://owasp.org/Top10/" }] : [])],
  };
}

/** Request data and other values an attacker controls, per language. Only what is visible on the line. */
export const UNTRUSTED: Record<string, RegExp> = {
  js: /\b(?:req|request|ctx\.request)\.(?:body|query|params|headers|cookies)\b|\blocation\.(?:search|hash|href)\b|\bdocument\.cookie\b|\bprocess\.argv\b|\bsearchParams\.get\(/,
  python: /\brequest\.(?:args|form|json|values|cookies|headers|data|files|GET|POST|query_params)\b|\bsys\.argv\b|\binput\(/,
  php: /\$_(?:GET|POST|REQUEST|COOKIE|SERVER|FILES)\b/,
};
