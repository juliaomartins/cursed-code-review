// @vitest-environment node
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkHook, checkRow, checkSteering, globToRegExp, parseMatrix, runAll, scriptRefs } from "../../../scripts/check-kiro.mjs";

const root = resolve(__dirname, "../../..");

describe("Kiro consistency check", () => {
  it("the repository's Kiro artefacts are consistent", () => {
    const { errors, summary } = runAll(root);
    expect(errors).toEqual([]);
    expect(summary).toMatch(/5 hooks, 5 steering files, 7 specs/);
  });

  it("matches globs the way hook patterns are written", () => {
    expect(globToRegExp("src/lib/scanner/**/*.ts").test("src/lib/scanner/lexer.ts")).toBe(true);
    expect(globToRegExp("src/lib/scanner/**/*.ts").test("src/lib/scanner/sub/x.ts")).toBe(true);
    expect(globToRegExp("src/**/__tests__/**/*.tsx").test("src/components/__tests__/crypt.test.tsx")).toBe(true);
    expect(globToRegExp(".kiro/hooks/*.kiro.hook").test(".kiro/hooks/a.kiro.hook")).toBe(true);
    expect(globToRegExp("e2e/*.ts").test("e2e/sub/x.ts")).toBe(false);
    expect(scriptRefs("Run `npm run test:scanner` then npm test")).toEqual(["test:scanner", "test"]);
  });

  it("reports hooks that could not run", () => {
    const ctx = { files: ["src/a.ts"], scripts: { test: "vitest run" } };
    const ok = {
      enabled: true,
      name: "n",
      description: "d",
      version: "1",
      when: { type: "fileEdited", patterns: ["src/*.ts"] },
      then: { type: "askAgent", prompt: "Run `npm test`" },
    };
    expect(checkHook("ok", ok, ctx)).toEqual([]);
    const errors = checkHook(
      "bad",
      { ...ok, when: { type: "fileEdited", patterns: ["lib/**/*.py"] }, then: { type: "askAgent", prompt: "Run `npm run nope`" } },
      ctx,
    );
    expect(errors.join("\n")).toMatch(/matches no file/);
    expect(errors.join("\n")).toMatch(/no "nope" script/);
    expect(checkHook("t", { ...ok, when: { type: "onSave" } }, ctx).join("\n")).toMatch(/when.type/);
  });

  it("reports invalid steering front matter", () => {
    expect(checkSteering("a.md", "---\ninclusion: always\n---\n# x")).toEqual([]);
    expect(checkSteering("b.md", "# no front matter")).toHaveLength(1);
    expect(checkSteering("c.md", "---\ninclusion: fileMatch\n---\n")[0]).toMatch(/fileMatchPattern/);
    expect(checkSteering("d.md", "---\ninclusion: sometimes\n---\n")[0]).toMatch(/inclusion/);
  });

  it("reports traceability rows whose evidence does not exist", () => {
    const [row] = parseMatrix('| X-1 | r | `src/nope.ts` | `src/lib/__tests__/accuracy.test.ts` › "a test that is not there" | ✅ |');
    const errors = checkRow(row, { root, scripts: {} }).join("\n");
    expect(errors).toMatch(/source file "src\/nope.ts" does not exist/);
    expect(errors).toMatch(/no test named "a test that is not there" in src\/lib\/__tests__\/accuracy.test.ts/);
    const [bare] = parseMatrix("| X-2 | r | `src/lib/report.ts` | — | ✅ |");
    expect(checkRow(bare, { root, scripts: {} }).join("\n")).toMatch(/marked ✅ but lists no test/);
  });
});
