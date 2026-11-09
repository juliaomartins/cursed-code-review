#!/usr/bin/env node
/**
 * Kiro consistency check (`npm run check:kiro`).
 *
 * Fails when the Kiro artefacts drift from the repository:
 * - hooks: invalid JSON or fields, file patterns that match nothing, `npm run <script>` that doesn't exist;
 * - steering: missing or invalid front matter;
 * - specs: a spec folder without requirements.md / design.md / tasks.md, duplicate requirement ids;
 * - traceability: a requirement missing from TRACEABILITY.md (or an unknown id there), a referenced file
 *   that doesn't exist, a referenced test name not found in its test file, an "implemented" row with no
 *   verification;
 * - docs: relative links in README.md, KIRO.md and .kiro/**.md that point nowhere.
 *
 * No dependencies. Exported functions are unit-tested in src/lib/__tests__/kiro.test.ts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE_TRIGGERS = ["fileEdited", "fileCreated", "fileDeleted"];
const TRIGGERS = [...FILE_TRIGGERS, "userTriggered", "promptSubmit", "agentStop"];
const ACTIONS = ["askAgent", "runCommand"];
const INCLUSION = ["always", "fileMatch", "manual"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report"]);

/** All repository files (relative, forward slashes), skipping build output and dependencies. */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).split("\\").join("/"));
    }
  };
  walk(root);
  return out;
}

/** Minimal glob → RegExp: `**` any depth, `*` within a segment, `?` one char. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** npm scripts mentioned as `npm run <name>` (also `npm test`). */
export function scriptRefs(text) {
  const refs = [...text.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
  if (/\bnpm test\b/.test(text)) refs.push("test");
  return refs;
}

/** Validates one parsed hook. Returns a list of error messages. */
export function checkHook(name, hook, { files, scripts }) {
  const errors = [];
  const need = (cond, msg) => cond || errors.push(`${name}: ${msg}`);
  need(typeof hook.enabled === "boolean", '"enabled" must be true or false');
  need(typeof hook.name === "string" && hook.name.trim(), '"name" is required');
  need(typeof hook.description === "string" && hook.description.trim(), '"description" is required');
  need(typeof hook.version === "string", '"version" must be a string, e.g. "1"');
  const when = hook.when ?? {};
  const then = hook.then ?? {};
  need(TRIGGERS.includes(when.type), `"when.type" must be one of ${TRIGGERS.join(", ")} (got ${JSON.stringify(when.type)})`);
  if (FILE_TRIGGERS.includes(when.type)) {
    need(Array.isArray(when.patterns) && when.patterns.length > 0, '"when.patterns" must list at least one glob for file triggers');
    for (const p of when.patterns ?? []) {
      const re = globToRegExp(p);
      need(
        files.some((f) => re.test(f)),
        `pattern "${p}" matches no file in the repository`,
      );
    }
  }
  need(ACTIONS.includes(then.type), `"then.type" must be one of ${ACTIONS.join(", ")} (got ${JSON.stringify(then.type)})`);
  if (then.type === "askAgent") need(typeof then.prompt === "string" && then.prompt.trim(), '"then.prompt" is required for askAgent');
  if (then.type === "runCommand") need(typeof then.command === "string" && then.command.trim(), '"then.command" is required for runCommand');
  for (const s of scriptRefs(`${then.prompt ?? ""} ${then.command ?? ""}`))
    need(s in scripts, `references "npm run ${s}", but package.json has no "${s}" script`);
  return errors;
}

/** Validates steering front matter. Tolerates CRLF so Windows checkouts behave like CI. */
export function checkSteering(name, text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, "\n"));
  if (!m) return [`${name}: missing front matter (---\\ninclusion: always\\n---)`];
  const fields = Object.fromEntries(
    m[1]
      .split("\n")
      .map((l) => /^(\w+):\s*(.*)$/.exec(l))
      .filter(Boolean)
      .map((x) => [x[1], x[2].replace(/^["']|["']$/g, "")]),
  );
  const errors = [];
  if (!INCLUSION.includes(fields.inclusion)) errors.push(`${name}: "inclusion" must be one of ${INCLUSION.join(", ")}`);
  if (fields.inclusion === "fileMatch" && !fields.fileMatchPattern) errors.push(`${name}: fileMatch steering needs "fileMatchPattern"`);
  return errors;
}

/** Requirement ids (**XXX-1**) declared in a requirements.md. */
export const requirementIds = (text) => [...text.matchAll(/\*\*([A-Z][A-Z0-9]*-\d+)\*\*/g)].map((m) => m[1]);

/** Parses TRACEABILITY.md rows. */
export function parseMatrix(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 7 || !/^[A-Z][A-Z0-9]*-\d+$/.test(cells[1])) continue;
    const [, id, , source, verified, status] = cells;
    rows.push({ id, source, verified, status });
  }
  return rows;
}

/** Checks one matrix row against the file system. */
export function checkRow(row, { root, scripts }) {
  const errors = [];
  const paths = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => !p.startsWith("npm "));
  for (const p of paths(row.source)) if (!existsSync(join(root, p))) errors.push(`${row.id}: source file "${p}" does not exist`);
  const tests = [...row.verified.matchAll(/`([^`]+)`\s*›\s*"([^"]+)"/g)];
  for (const [, file, name] of tests) {
    const full = join(root, file);
    if (!existsSync(full)) errors.push(`${row.id}: test file "${file}" does not exist`);
    else if (!readFileSync(full, "utf8").includes(`"${name}"`)) errors.push(`${row.id}: no test named "${name}" in ${file}`);
  }
  for (const p of paths(row.verified)) if (!tests.some((t) => t[1] === p) && !existsSync(join(root, p))) errors.push(`${row.id}: "${p}" does not exist`);
  for (const s of scriptRefs(row.verified)) if (!(s in scripts)) errors.push(`${row.id}: "npm run ${s}" is not a package.json script`);
  const verifiedSomehow = tests.length > 0 || scriptRefs(row.verified).length > 0 || paths(row.verified).length > 0;
  if (row.status.includes("✅") && !verifiedSomehow) errors.push(`${row.id}: marked ✅ but lists no test or command`);
  if (!/[✅🟡❌]/u.test(row.status)) errors.push(`${row.id}: status must be ✅, 🟡 or ❌`);
  return errors;
}

/** Relative markdown links that point at nothing. */
export function checkLinks(file, text, root) {
  const errors = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = decodeURI(target.split("#")[0]);
    if (!clean) continue;
    if (!existsSync(resolve(root, dirname(file), clean))) errors.push(`${file}: link "${target}" points to a missing file`);
  }
  return errors;
}

/** Runs every check. Returns { errors, summary }. */
export function runAll(root) {
  const errors = [];
  const files = listFiles(root);
  const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};

  const hookDir = join(root, ".kiro/hooks");
  const hooks = existsSync(hookDir) ? readdirSync(hookDir).filter((f) => f.endsWith(".kiro.hook")) : [];
  if (!hooks.length) errors.push(".kiro/hooks: no *.kiro.hook files");
  for (const h of hooks) {
    try {
      errors.push(...checkHook(`.kiro/hooks/${h}`, JSON.parse(readFileSync(join(hookDir, h), "utf8")), { files, scripts }));
    } catch (e) {
      errors.push(`.kiro/hooks/${h}: invalid JSON (${e.message})`);
    }
  }

  const steerDir = join(root, ".kiro/steering");
  const steering = existsSync(steerDir) ? readdirSync(steerDir).filter((f) => f.endsWith(".md")) : [];
  for (const s of steering) errors.push(...checkSteering(`.kiro/steering/${s}`, readFileSync(join(steerDir, s), "utf8")));

  const specDir = join(root, ".kiro/specs");
  const specs = readdirSync(specDir).filter((d) => statSync(join(specDir, d)).isDirectory());
  const declared = new Map();
  for (const s of specs) {
    for (const f of ["requirements.md", "design.md", "tasks.md"]) if (!existsSync(join(specDir, s, f))) errors.push(`.kiro/specs/${s}: missing ${f}`);
    const req = join(specDir, s, "requirements.md");
    if (!existsSync(req)) continue;
    for (const id of requirementIds(readFileSync(req, "utf8"))) {
      if (declared.has(id)) errors.push(`${id}: declared twice (${declared.get(id)} and ${s})`);
      declared.set(id, s);
    }
  }

  const matrixPath = join(specDir, "TRACEABILITY.md");
  const rows = existsSync(matrixPath) ? parseMatrix(readFileSync(matrixPath, "utf8")) : [];
  if (!rows.length) errors.push(".kiro/specs/TRACEABILITY.md: missing or has no rows");
  const inMatrix = new Set(rows.map((r) => r.id));
  for (const id of declared.keys())
    if (!inMatrix.has(id)) errors.push(`${id}: declared in ${declared.get(id)}/requirements.md but missing from TRACEABILITY.md`);
  for (const r of rows) {
    if (!declared.has(r.id)) errors.push(`${r.id}: in TRACEABILITY.md but not declared in any requirements.md`);
    errors.push(...checkRow(r, { root, scripts }));
  }

  const docs = ["README.md", "KIRO.md", ...files.filter((f) => f.startsWith(".kiro/") && f.endsWith(".md"))].filter((f) => existsSync(join(root, f)));
  for (const d of docs) errors.push(...checkLinks(d, readFileSync(join(root, d), "utf8"), root));

  const count = (s) => rows.filter((r) => r.status.includes(s)).length;
  return {
    errors,
    summary: `${hooks.length} hooks, ${steering.length} steering files, ${specs.length} specs, ${declared.size} requirements (${count("✅")} ✅, ${count("🟡")} 🟡, ${count("❌")} ❌), ${docs.length} docs link-checked`,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { errors, summary } = runAll(root);
  if (errors.length) {
    console.error(`Kiro consistency check failed (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`\nChecked: ${summary}`);
    process.exit(1);
  }
  console.log(`✓ Kiro artefacts are consistent: ${summary}`);
}
