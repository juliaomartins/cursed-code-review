import { describe, expect, it } from "vitest";
import { scan, scanDetailed } from "../scanner";
import { maskSource } from "../scanner/lexer";
import { RULES_META } from "../scanner/rules";
import { entropy, isSecretName } from "../scanner/secrets";
import type { Language } from "../types";
import { FAKE } from "@/test/fakeSecrets";

const rules = (code: string, lang: Language) => scan(code, lang).map((f) => f.ruleId);
const only = (code: string, lang: Language, rule: string) => scan(code, lang).filter((f) => f.ruleId === rule);

describe("lexer", () => {
  it("masks comments and string contents, keeping columns", () => {
    const src = ["const a = 'SELECT * FROM t'; // return here", "/* eval(x)", "   still comment */ run();", "const t = `a ${b} c`;"];
    const m = maskSource(src, "javascript");
    m.forEach((l, i) => expect(l).toHaveLength(src[i].length));
    expect(m[0]).toBe("const a = '_______________';               ");
    expect(m[1].trim()).toBe("");
    expect(m[2].trim()).toBe("run();");
    expect(m[3]).toBe("const t = `________`;");
  });

  it("handles Python triple quotes, # comments and unterminated input without throwing", () => {
    const m = maskSource(['x = """doc', "eval(y)", '"""  # eval(z)', "s = 'open"], "python");
    expect(m[1]).toBe("_______");
    expect(m[2].trim()).toBe('"""');
    expect(m[3]).toBe("s = '____");
  });
});

describe("rule corpus: vulnerable code is found, lookalikes are not", () => {
  it("SQL injection needs a real statement shape", () => {
    expect(rules("db.query(`SELECT * FROM users WHERE id = ${id}`);", "javascript")).toContain("sql-injection");
    expect(rules('db.query("DELETE FROM users WHERE id = " + id);', "javascript")).toContain("sql-injection");
    expect(rules("db.query(`UPDATE users SET name = '${n}'`);", "javascript")).toContain("sql-injection");
    // UI text that merely contains an SQL keyword.
    expect(rules("toast(`Please select an option, ${name}`);", "javascript")).toEqual([]);
    expect(rules('label = "Update available: " + version;', "javascript")).toEqual([]);
    // Parameterised already.
    expect(rules("db.query('SELECT * FROM users WHERE id = $1', [id]);", "javascript")).toEqual([]);
    // Inside a comment.
    expect(rules("// db.query(`SELECT * FROM users WHERE id = ${id}`);", "javascript")).toEqual([]);
  });

  it("marks injection CRITICAL only with visible untrusted input, and constants as low confidence", () => {
    const [crit] = only("db.query(`SELECT * FROM users WHERE name = '${req.body.name}'`);", "javascript", "sql-injection");
    expect(crit).toMatchObject({ severity: "CRITICAL", exposure: "untrusted-input", confidence: "high" });
    const [plain] = only("db.query(`SELECT * FROM users WHERE name = '${name}'`);", "javascript", "sql-injection");
    expect(plain.severity).toBe("HIGH");
    expect(plain.exposure).toBeUndefined();
    const [constant] = only("db.query(`SELECT * FROM ${TABLE} LIMIT 10`);", "javascript", "sql-injection");
    expect(constant.confidence).toBe("low");
    expect(constant.why).toMatch(/may be safe/);
  });

  it("command injection: child_process only, never regex .exec()", () => {
    const vuln = "const { exec } = require('child_process');\nexec(`convert ${req.query.file} out.png`);";
    const [f] = only(vuln, "javascript", "command-injection");
    expect(f).toMatchObject({ severity: "CRITICAL", autofix: false, exposure: "untrusted-input" });
    expect(f.fix.after).toEqual(f.fix.before);
    expect(rules("const m = /a(b)/.exec(text);\nexec(`x ${y}`);", "javascript")).not.toContain("command-injection");
    expect(rules("const { execFile } = require('child_process');\nexecFile('convert', [file, 'out.png']);", "javascript")).not.toContain("command-injection");
    expect(rules('import os\nos.system(f"rm -rf {path}")', "python")).toContain("command-injection");
    expect(rules('subprocess.run(f"ls {d}", shell=True)', "python")).toContain("command-injection");
    expect(rules('subprocess.run(["ls", d])', "python")).not.toContain("command-injection");
    expect(rules("<?php system(\"ping \" . $_GET['host']);", "php")).toContain("command-injection");
    expect(rules("<?php system('ls -la');", "php")).not.toContain("command-injection");
  });

  it("code injection: eval on data, not eval-like names", () => {
    expect(rules("const out = eval(userCode);", "javascript")).toContain("code-injection");
    expect(rules("const fn = new Function(body);", "javascript")).toContain("code-injection");
    expect(rules("model.eval()\nresult = ast.literal_eval(text)", "python")).toEqual([]);
    expect(rules("result = eval(expr)", "python")).toContain("code-injection");
    expect(rules("const x = evaluate(a); // eval(b)", "javascript")).toEqual([]);
  });

  it("TLS and JWT verification", () => {
    const [tls] = only("https.request({ host, rejectUnauthorized: false });", "javascript", "tls-verification-disabled");
    expect(tls.fix.after[0]).toContain("rejectUnauthorized: true");
    expect(only("r = requests.get(url, verify=False)", "python", "tls-verification-disabled")[0].fix.after[0]).toContain("verify=True");
    expect(rules("def f(verify=False):\n    pass", "python")).not.toContain("tls-verification-disabled");
    expect(rules("data = jwt.decode(token, verify=False)", "python")).toContain("jwt-verification-disabled");
    expect(rules('jwt.verify(token, key, { algorithms: ["none"] });', "javascript")).toContain("jwt-verification-disabled");
    expect(rules('jwt.verify(token, key, { algorithms: ["HS256"] });', "javascript")).toEqual([]);
  });

  it("swallowed errors: empty catch and catch-all pass, not deliberate specific passes", () => {
    expect(rules("try { run(); } catch (e) {}", "javascript")).toContain("swallowed-error");
    expect(rules("try {\n  run();\n} catch (e) {\n  // nothing\n}", "javascript")).toContain("swallowed-error");
    expect(rules("try { run(); } catch (e) { log(e); }", "javascript")).not.toContain("swallowed-error");
    expect(rules("try:\n    run()\nexcept:\n    pass", "python")).toContain("swallowed-error");
    expect(rules("try:\n    run()\nexcept Exception:\n    pass", "python")).toContain("swallowed-error");
    expect(rules("try:\n    v = d[k]\nexcept KeyError:\n    pass", "python")).not.toContain("swallowed-error");
    expect(rules("try:\n    run()\nexcept Exception:\n    pass\n    log()", "python")).not.toContain("swallowed-error");
  });

  it("secrets: credential names with credential values only", () => {
    expect(rules("const tokenType = 'Bearer-Token';", "javascript")).toEqual([]);
    expect(rules("const authorName = 'Juliao Martins';", "javascript")).toEqual([]);
    expect(rules("const passwordLabel = 'Enter your password';", "javascript")).toEqual([]);
    expect(rules("const password = 'changeme';", "javascript")).toEqual([]);
    expect(rules(`const dbPassword = '${FAKE.dbPassword}';`, "javascript")).toContain("hardcoded-secret");
    expect(rules(`const apiKey = '${FAKE.awsKeyId}';`, "javascript")).toContain("hardcoded-secret");
    const [live] = only(`const key = '${FAKE.stripeLive}';`, "javascript", "hardcoded-secret");
    expect(live).toMatchObject({ severity: "CRITICAL", confidence: "high" });
    const [generic] = only(`SECRET_KEY = '${FAKE.generic}'`, "python", "hardcoded-secret");
    expect(generic).toMatchObject({ severity: "HIGH", confidence: "medium" });
    // Regression: a random letter string is a credential even without digits; plain words are not.
    expect(rules(`const token = '${FAKE.github}';`, "javascript")).toContain("hardcoded-secret");
    expect(rules("const tokenScope = 'read-write';", "javascript")).toEqual([]);
    expect(rules("const password = 'readwrite';", "javascript")).toEqual([]);
    expect(isSecretName("AWS_SECRET_ACCESS_KEY")).toBe(true);
    expect(isSecretName("secretHint")).toBe(false);
    expect(entropy("aaaaaaaa")).toBe(0);
  });

  it("dead code ignores comments after a return, and keywords in strings", () => {
    expect(rules("function f() {\n  return 1;\n  // explains why\n}", "javascript")).toEqual([]);
    expect(rules("function f() {\n  return 1;\n  cleanup();\n}", "javascript")).toContain("dead-code");
    expect(rules("const s = `\nreturn x;\nfoo();\n`;", "javascript")).toEqual([]);
  });

  it("off-by-one only in code, not in strings or comments", () => {
    expect(rules("for (let i = 0; i <= a.length; i++) {}", "javascript")).toContain("off-by-one");
    expect(rules('const hint = "for (let i = 0; i <= a.length; i++)";', "javascript")).toEqual([]);
    expect(rules("for (let i = 1; i <= a.length; i++) {}", "javascript")).toEqual([]);
  });
});

describe("locations, duplicates, suppression and robustness", () => {
  it("reports exact 1-based columns", () => {
    const [f] = only("  db.query(`SELECT * FROM t WHERE id = ${id}`);", "javascript", "sql-injection");
    expect(f.column).toBe(12);
    const [s] = only(`const key = '${FAKE.stripeLive}';`, "javascript", "hardcoded-secret");
    expect(s.column).toBe(13);
  });

  it("never reports the same rule twice on one line", () => {
    const fs = scan("db.query(`SELECT * FROM a WHERE x = ${p}`); db.query(`SELECT * FROM b WHERE y = ${q}`);", "javascript");
    expect(fs.filter((f) => f.ruleId === "sql-injection")).toHaveLength(1);
    expect(new Set(fs.map((f) => f.id)).size).toBe(fs.length);
  });

  it("honours ccr-ignore comments, per rule, and not inside strings", () => {
    const code = [
      "db.query(`SELECT * FROM a WHERE x = ${p}`); // ccr-ignore",
      "// ccr-ignore: sql-injection",
      "db.query(`SELECT * FROM b WHERE y = ${q}`);",
      "// ccr-ignore: xss",
      "db.query(`SELECT * FROM c WHERE z = ${r}`);",
      'db.query(`SELECT * FROM d WHERE w = ${s}`, "ccr-ignore");',
    ].join("\n");
    const res = scanDetailed(code, "javascript");
    expect(res.suppressed).toBe(2);
    expect(res.findings.map((f) => f.fix.startLine)).toEqual([5, 6]);
  });

  it("survives malformed, binary-ish and huge input", () => {
    for (const junk of ["`unterminated ${", "/* never closed\nreturn 1;\nx()", "\u0000￿'\"`", "}}}{{{))((", ""]) {
      for (const lang of ["javascript", "typescript", "python", "php"] as Language[]) expect(() => scan(junk, lang)).not.toThrow();
    }
    const minified = "var a=1;".repeat(1000);
    const res = scanDetailed(`${minified}\nfor (let i = 0; i <= a.length; i++) {}`, "javascript");
    expect(res.skippedLines).toBe(1);
    expect(res.findings.map((f) => f.ruleId)).toEqual(["off-by-one"]);
    const big = Array.from({ length: 1500 }, (_, i) => `const v${i} = items.find((x) => x.id === ${i});`).join("\n");
    const t = performance.now();
    scan(big, "javascript");
    expect(performance.now() - t).toBeLessThan(3000);
  });

  it("every finding answers what, where, why, impact and how", () => {
    const sample = [
      "const { exec } = require('child_process');",
      "exec(`ls ${dir}`);",
      "db.query(`SELECT * FROM t WHERE id = ${id}`);",
      "try { a(); } catch (e) {}",
      `const apiKey = '${FAKE.awsKeyId}';`,
    ].join("\n");
    for (const f of scan(sample, "javascript")) {
      const meta = RULES_META[f.ruleId!];
      expect(meta, f.ruleId).toBeDefined();
      expect(f.bug.length).toBeGreaterThan(3);
      expect(f.fix.startLine).toBeGreaterThan(0);
      expect(f.column).toBeGreaterThan(0);
      expect(f.why.length).toBeGreaterThan(40);
      expect(meta.impact.length).toBeGreaterThan(30);
      expect(meta.remediation.length).toBeGreaterThan(30);
      expect(meta.cwe).toBeGreaterThan(0);
    }
  });
});
