import { describe, expect, it } from "vitest";
import { diffLines, toHunks, unifiedDiff } from "../diff";
import { tokenize } from "../highlight";
import { reportFileName, toIssue, toMarkdown, toReviewComments } from "../report";
import { reviewFromPullRequest, reviewFromSamples } from "../review/factory";
import { reviewReducer, initialState } from "../review/reducer";
import { fixturePullRequest } from "@/test/fixtures";

describe("diff", () => {
  it("produces a minimal line diff", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c"]).map((d) => `${d.type}:${d.text}`)).toEqual(["same:a", "del:b", "add:x", "same:c"]);
  });

  it("groups changes into hunks with context", () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const b = [...a];
    b[2] = "X";
    b[17] = "Y";
    const hunks = toHunks(diffLines(a, b), 2);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toBe("@@ -1,5 +1,5 @@");
  });

  it("renders unified diffs and nothing for identical input", () => {
    expect(unifiedDiff("f.js", "a\nb", "a\nc")).toBe("--- a/f.js\n+++ b/f.js\n@@ -1,2 +1,2 @@\n a\n-b\n+c");
    expect(unifiedDiff("f.js", "a", "a")).toBe("");
  });
});

describe("report", () => {
  it("exports markdown with stats, per-file tables and patches", () => {
    let s = reviewReducer(initialState, { type: "start", review: reviewFromSamples("cursed-login") });
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:possessor:5" });
    s = reviewReducer(s, { type: "ignore", findingId: "cursed-login:gremlin:7" });
    s = reviewReducer(s, { type: "ignore", findingId: "leaky-cache:wraith:22", reason: "false-positive" });
    const md = toMarkdown(s.review!, new Date("2026-10-31T12:00:00Z"));
    expect(md).toContain("# Code review report — Mateklamar samples");
    expect(md).toContain("**Report generated:** 2026-10-31T12:00:00.000Z");
    expect(md).toContain("**11 open findings** out of 14.");
    expect(md).toContain("| Critical | 0 | 1 | 1 |");
    expect(md).toContain("| **Total** | **11** | **1** | **2** |");
    expect(md).toMatch(/## Fix first\n\nOpen findings ranked[^\n]*\n\n1\. \*\*High · /);
    expect(md).toContain("#### Critical · SQL injection — line 5:");
    expect(md).toContain("- **Status:** Fixed · verified by re-scan");
    expect(md).toContain("[CWE-89](https://cwe.mitre.org/data/definitions/89.html)");
    expect(md).toContain("- **Status:** Dismissed · false positive");
    expect(md).toContain("+    'SELECT * FROM users WHERE name = $1', [req.body.name]");
    // The secret never appears, not in the finding, the suggested change or the patch.
    expect(md).not.toContain("4f9a8b7c6d5e");
    expect(md).toContain("«redacted»");
    expect(reportFileName(s.review!)).toBe("mateklamar-review-Mateklamar-samples.md");
  });

  it("never puts a secret value into a GitHub issue or review comment", () => {
    const s = reviewReducer(initialState, { type: "start", review: reviewFromSamples("cursed-login") });
    const secret = "4f9a8b7c6d5e"; // the tail of the sample's fake key
    expect(s.review!.files[0].code).toContain(secret);
    const { body } = toIssue(s.review!);
    expect(body).not.toContain(secret);
    expect(body).toContain("«redacted»");
    for (const c of toReviewComments(s.review!)) expect(c.body).not.toContain(secret);
  });

  it("builds inline review comments with suggestions, skipping ignored monsters", async () => {
    const pr = fixturePullRequest({ owner: "o", repo: "r", number: 3 });
    let s = reviewReducer(initialState, { type: "start", review: reviewFromPullRequest(pr) });
    const all = s.review!.files.flatMap((f) => f.findings);
    expect(all.length).toBeGreaterThan(0);
    s = reviewReducer(s, { type: "ignore", findingId: all[0].id });
    const comments = toReviewComments(s.review!);
    expect(comments).toHaveLength(all.length - 1);
    expect(comments[0].body).toContain("```suggestion");
    expect(s.review!.source).toMatchObject({ kind: "pr", label: "o/r#3", live: true, headSha: "c".repeat(40) });
  });
});

describe("review comments for real PRs", () => {
  it("anchors comments to the original lines with multi-line suggestions", () => {
    let s = reviewReducer(initialState, { type: "start", review: reviewFromSamples("leaky-cache") });
    s = reviewReducer(s, { type: "banish", findingId: "leaky-cache:leech:9" }); // shifts later lines by one
    const comments = toReviewComments(s.review!).filter((c) => c.path === "services/leaky-cache.py");
    const twins = comments.find((c) => c.body.includes("Twin Ghosts"))!;
    expect(twins).toMatchObject({ startLine: 14, line: 16 });
    expect(twins.body).toContain("```suggestion\n    with _balance_lock:");
    expect(comments.find((c) => c.body.includes("Void Wraith"))!.line).toBe(22);
  });
});

describe("highlight", () => {
  it("tokenizes keywords, strings, comments, numbers and calls", () => {
    const t = tokenize("const x = foo('a', 1); // hi", "javascript");
    expect(t.find((k) => k.type === "keyword")?.text).toBe("const");
    expect(t.find((k) => k.type === "string")?.text).toBe("'a'");
    expect(t.find((k) => k.type === "number")?.text).toBe("1");
    expect(t.find((k) => k.type === "fn")?.text).toBe("foo");
    expect(t[t.length - 1]).toEqual({ type: "comment", text: "// hi" });
    expect(t.map((k) => k.text).join("")).toBe("const x = foo('a', 1); // hi");
  });

  it("handles Python prefixes and PHP variables", () => {
    expect(tokenize('re.match(r"\\w+", s)', "python").find((k) => k.type === "string")?.text).toBe('r"\\w+"');
    expect(tokenize("$id = 1;", "php")[0]).toEqual({ type: "variable", text: "$id" });
  });
});

describe("file names in the crypt", async () => {
  const { displayNames } = await import("@/components/crypt/FileNav");
  it("adds parent folders only when names repeat", () => {
    expect(displayNames(["src/app/api/pr/route.ts", "src/app/api/review/route.ts", "src/lib/patch.ts"])).toEqual([
      "pr/route.ts",
      "review/route.ts",
      "patch.ts",
    ]);
    expect(displayNames(["a/x.ts", "a/x.ts"])).toEqual(["a/x.ts", "a/x.ts"]);
  });
});
