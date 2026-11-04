import { describe, expect, it } from "vitest";
import { diffLines, toHunks, unifiedDiff } from "../diff";
import { tokenize } from "../highlight";
import { reportFileName, toMarkdown, toReviewComments } from "../report";
import { reviewFromPullRequest, reviewFromSamples } from "../review/factory";
import { reviewReducer, initialState } from "../review/reducer";
import { fetchPullRequest } from "../github";

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
    const md = toMarkdown(s.review!, new Date("2026-10-31T12:00:00Z"));
    expect(md).toContain("# Cursed Code Review — Cursed samples");
    expect(md).toContain("_Generated Oct 31, 2026_");
    expect(md).toContain("**12 monsters still lurk.**");
    expect(md).toContain("| 14 | 1 | 1 | 12 | HIGH | 30% |");
    expect(md).toContain("| 5 | Possessor | SQL injection | HIGH | Banished |");
    expect(md).toContain("| 7 | Gremlin | Hardcoded secret | HIGH | Ignored |");
    expect(md).toContain("+    'SELECT * FROM users WHERE name = $1', [req.body.name]");
    expect(reportFileName(s.review!)).toBe("cursed-review-Cursed-samples.md");
  });

  it("builds inline review comments with suggestions, skipping ignored monsters", async () => {
    const pr = await fetchPullRequest({ owner: "o", repo: "r", number: 3 }, { signedIn: true, latencyMs: 0 });
    let s = reviewReducer(initialState, { type: "start", review: reviewFromPullRequest(pr) });
    const all = s.review!.files.flatMap((f) => f.findings);
    expect(all.length).toBeGreaterThan(0);
    s = reviewReducer(s, { type: "ignore", findingId: all[0].id });
    const comments = toReviewComments(s.review!);
    expect(comments).toHaveLength(all.length - 1);
    expect(comments[0].body).toContain("```suggestion");
    expect(s.review!.source).toMatchObject({ kind: "pr", label: "o/r#3" });
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
