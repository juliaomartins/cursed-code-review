import { describe, expect, it } from "vitest";
import { SAMPLES } from "../samples";
import { detectLanguage, languageFromPath, scan } from "../scanner";
import type { Finding, Language } from "../types";

const at = (f: Finding) => f.fix.startLine + f.lineOffsets[0];
const summary = (code: string, lang: Language) => scan(code, lang).map((f) => `${f.kind}@${at(f)}`);

describe("scan · cursed samples", () => {
  it("finds the six monsters of cursed-login.js on the lines from the design", () => {
    const s = SAMPLES.find((x) => x.id === "cursed-login")!;
    expect(summary(s.code, s.language)).toEqual(["possessor@5", "gremlin@7", "wraith@8", "imp@11", "leech@12", "zombie@15"]);
  });

  it("finds leech, twin ghosts, wraith and possessor in leaky-cache.py", () => {
    const s = SAMPLES.find((x) => x.id === "leaky-cache")!;
    expect(summary(s.code, s.language)).toEqual(["leech@9", "twins@14", "wraith@22", "possessor@27"]);
  });

  it("finds imp, zombie, wraith and XSS possessor in haunted-api.ts", () => {
    const s = SAMPLES.find((x) => x.id === "haunted-api")!;
    expect(summary(s.code, s.language)).toEqual(["imp@15", "zombie@20", "wraith@25", "possessor@29"]);
  });

  it("gives every finding a stable id, a severity and an explanation", () => {
    for (const s of SAMPLES) {
      for (const f of scan(s.code, s.language, { fileId: s.id })) {
        expect(f.id).toBe(`${s.id}:${f.kind}:${at(f)}`);
        expect(["HIGH", "MED", "LOW"]).toContain(f.severity);
        expect(f.why.length).toBeGreaterThan(20);
        expect(f.eli5.length).toBeGreaterThan(20);
        expect(f.status).toBe("lurking");
      }
    }
  });
});

describe("scan · rules", () => {
  it("parameterises SQL in JS template literals", () => {
    const [f] = scan("db.query(`SELECT * FROM t WHERE a = ${a} AND b = '${b}'`);", "javascript");
    expect(f.kind).toBe("possessor");
    expect(f.fix.after[0]).toBe("db.query('SELECT * FROM t WHERE a = $1 AND b = $2', [a, b]);");
  });

  it("parameterises SQL built with concatenation", () => {
    const [f] = scan('db.query("SELECT * FROM t WHERE id = " + id);', "javascript");
    expect(f.fix.after[0]).toBe("db.query('SELECT * FROM t WHERE id = $1', [id]);");
  });

  it("parameterises Python f-strings and % formatting", () => {
    expect(scan('cur.execute(f"DELETE FROM t WHERE id = {i}")', "python")[0].fix.after[0]).toBe('cur.execute("DELETE FROM t WHERE id = %s", (i,))');
    expect(scan(`cur.execute("SELECT * FROM t WHERE n = '%s'" % name)`, "python")[0].fix.after[0]).toBe('cur.execute("SELECT * FROM t WHERE n = %s", (name,))');
  });

  it("binds PHP interpolated SQL and escapes echoed request data", () => {
    const sql = scan(`$db->query("SELECT * FROM users WHERE id = '$id'");`, "php")[0];
    expect(sql.fix.after[0]).toBe(`$db->query("SELECT * FROM users WHERE id = ?", [$id]);`);
    const xss = scan("echo $_GET['q'];", "php")[0];
    expect(xss.bug).toMatch(/XSS/);
    expect(xss.fix.after[0]).toBe("echo htmlspecialchars($_GET['q'], ENT_QUOTES, 'UTF-8');");
  });

  it("swaps innerHTML of plain expressions for textContent", () => {
    const [f] = scan("el.innerHTML = userInput;", "javascript");
    expect(f.fix.after[0]).toBe("el.textContent = userInput;");
  });

  it("leaves already-escaped HTML alone and only wraps what isn't", () => {
    expect(scan("card.innerHTML = `<h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.bio)}</p>`;", "javascript")).toEqual([]);
    expect(scan("el.innerHTML = DOMPurify.sanitize(html);", "javascript")).toEqual([]);
    const [f] = scan("card.innerHTML = `<h2>${escapeHtml(user.name)}</h2><p>${user.bio}</p>`;", "javascript");
    expect(f.fix.after[0]).toBe("card.innerHTML = `<h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.bio)}</p>`;");
  });

  it("ignores innerHTML of static strings", () => {
    expect(scan("el.innerHTML = '<b>hi</b>';", "javascript")).toEqual([]);
  });

  it("moves secrets to the environment per language", () => {
    expect(scan("const stripeKey = 'sk_live_abcdef123';", "typescript")[0].fix.after[0]).toBe("const stripeKey = process.env.STRIPE_KEY;");
    const py = scan('DB_PASSWORD = "hunter2hunter2"', "python")[0];
    expect(py.fix.after[0]).toBe('DB_PASSWORD = os.environ["DB_PASSWORD"]');
    expect(py.fix.note).toMatch(/import os/);
    expect(scan("$apiToken = 'abcdef123456';", "php")[0].fix.after[0]).toBe("$apiToken = getenv('API_TOKEN');");
    expect(scan("const config = { clientSecret: 'abc123xyz' };", "javascript")[0].fix.after[0]).toBe("const config = { clientSecret: process.env.CLIENT_SECRET };");
  });

  it("does not flag placeholders or non-secret strings", () => {
    expect(scan("const token = '${TOKEN}';", "javascript")).toEqual([]);
    expect(scan("const name = 'Hallowe en party';", "javascript")).toEqual([]);
    expect(scan("const password = 'your-password-here';", "javascript")).toEqual([]);
  });

  it("guards null access with optional chaining, but respects existing guards", () => {
    const [f] = scan("const el = document.querySelector('#x');\nel.classList.add('on');", "javascript");
    expect(f.kind).toBe("wraith");
    expect(f.fix.after[0]).toBe("el?.classList?.add('on');");
    expect(scan("const el = document.querySelector('#x');\nif (!el) return;\nel.classList.add('on');", "javascript")).toEqual([]);
    expect(scan("const u = await getUser();\nreturn u.name;", "javascript")).toEqual([]);
  });

  it("only treats a value as nullable when the risky call is the whole expression", () => {
    expect(scan('const parsed = parsePrUrl(params.get("url") ?? "");\nif (!parsed.ok) return;', "typescript")).toEqual([]);
    expect(scan("const n = map.get(k) ?? 0;\nn.toFixed(1);", "javascript")).toEqual([]);
    expect(scan("const name = users.find((u) => u.id === id).name;\nname.trim();", "javascript").map((f) => f.kind)).not.toContain("wraith");
    expect(scan("const u = users.find((u) => u.id === id);\nu.name.trim();", "javascript")[0].kind).toBe("wraith");
    expect(scan("v = d.get('k') or {}\nprint(v.keys())", "python")).toEqual([]);
  });

  it("does not use optional chaining on assignment targets", () => {
    expect(scan("const u = list.find((x) => x.id === 1);\nu.name = 'x';", "javascript")).toEqual([]);
  });

  it("guards Python None access", () => {
    const [f] = scan("m = re.search(r'x', s)\nreturn m.group(0)", "python");
    expect(f.fix.after[0]).toBe("return m.group(0) if m else None");
    expect(scan("m = re.search(r'x', s)\nif m:\n    print(m.group(0))", "python")).toEqual([]);
  });

  it("fixes off-by-one loops and indexes", () => {
    expect(scan("for ($i = 0; $i <= count($xs); $i++) {", "php")[0].fix.after[0]).toBe("for ($i = 0; $i < count($xs); $i++) {");
    expect(scan("for i in range(len(xs) + 1):", "python")[0].fix.after[0]).toBe("for i in range(len(xs)):");
    expect(scan("last = xs[len(xs)]", "python")[0].fix.after[0]).toBe("last = xs[len(xs) - 1]");
    expect(scan("const last = xs[xs.length];", "javascript")[0].fix.after[0]).toBe("const last = xs[xs.length - 1];");
    expect(scan("for (let i = 0; i < xs.length; i++) {", "javascript")).toEqual([]);
    expect(scan("for (let n = 1; n <= segs.length; n++) {", "javascript")).toEqual([]);
    expect(scan("for (let i = start * 2; i <= xs.length; i++) {", "javascript")[0].kind).toBe("imp");
  });

  it("caps module-level caches that only grow", () => {
    const code = "const seen = new Map();\nfunction track(k, v) {\n  seen.set(k, v);\n}";
    const [f] = scan(code, "javascript");
    expect(f.kind).toBe("leech");
    expect(f.fix.after).toEqual(["  seen.set(k, v);", "  if (seen.size > 1000) seen.delete(seen.keys().next().value);"]);
    expect(scan(code + "\nfunction reset() {\n  seen.clear();\n}", "javascript")).toEqual([]);
  });

  it("removes every unreachable line after a return as one zombie", () => {
    const code = "function f() {\n  return 1;\n  a();\n\n  b();\n}";
    const [f] = scan(code, "javascript");
    expect(f.kind).toBe("zombie");
    expect(f.fix.before).toEqual(["  a();", "", "  b();"]);
    expect(f.fix.after).toEqual([]);
    expect(f.dimOffsets).toEqual([0, 1, 2]);
    expect(f.why).toMatch(/These 2 lines/);
  });

  it("does not treat switch cases or Python else branches as dead", () => {
    expect(scan("switch (x) {\n  case 1:\n    return a;\n  case 2:\n    return b;\n}", "javascript")).toEqual([]);
    expect(scan("def f(x):\n    if x:\n        return 1\n    else:\n        return 2", "python")).toEqual([]);
  });

  it("wraps JS read-modify-write races in a lock", () => {
    const code = "async function pay(id, n) {\n  const bal = await store.getBalance(id);\n  await store.setBalance(id, bal - n);\n}";
    const [f] = scan(code, "javascript");
    expect(f.kind).toBe("twins");
    expect(f.lineOffsets).toEqual([0, 1]);
    expect(f.fix.after).toEqual(["  const release = await lock.acquire();", ...f.fix.before, "  release();"]);
  });

  it("restricts findings to changed lines in PR mode", () => {
    const s = SAMPLES[0];
    const only = scan(s.code, s.language, { onlyLines: [7, 11] }).map((f) => f.kind);
    expect(only).toEqual(["gremlin", "imp"]);
  });

  it("returns nothing for clean code", () => {
    expect(scan("export const add = (a, b) => a + b;\n", "javascript")).toEqual([]);
  });
});

describe("language helpers", () => {
  it("detects languages from code", () => {
    expect(detectLanguage("def f(x):\n    return None")).toBe("python");
    expect(detectLanguage("<?php echo $x;")).toBe("php");
    expect(detectLanguage("interface A { b: string }")).toBe("typescript");
    expect(detectLanguage("const a = require('x');")).toBe("javascript");
    expect(detectLanguage("hello world")).toBeNull();
  });

  it("maps file extensions", () => {
    expect(languageFromPath("a/b.py")).toBe("python");
    expect(languageFromPath("x.tsx")).toBe("typescript");
    expect(languageFromPath("x.php")).toBe("php");
    expect(languageFromPath("x.mjs")).toBe("javascript");
  });
});
