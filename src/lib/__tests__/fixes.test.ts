import { describe, expect, it } from "vitest";
import { changedFiles, defaultBranchName, fixDestination, fixPrBody, fixPrTitle, sha256Hex } from "../fixes";
import { banishAllPlan, REVIEW_FIRST } from "../review/bulk";
import { reviewFromPullRequest, reviewFromSamples, reviewFromScan } from "../review/factory";
import { reviewReducer, initialState, type ReviewState } from "../review/reducer";
import { statsOf } from "../review/selectors";
import { scan } from "../scanner";
import { fixturePullRequest, fixtureScan } from "@/test/fixtures";

const start = (r: ReturnType<typeof reviewFromScan>): ReviewState => reviewReducer(initialState, { type: "start", review: r });

describe("Banish all", () => {
  it("plans every lurking fix, leaving Twin Ghosts and stale ones for review", () => {
    const s = start(reviewFromSamples());
    const plan = banishAllPlan(s.review!, s.review!.files.map((f) => f.id));
    const leaky = plan.find((p) => p.file.id === "leaky-cache")!;
    expect(leaky.apply.map((f) => f.kind)).toEqual(["leech", "wraith", "possessor"]);
    expect(leaky.skip.map((f) => f.kind)).toEqual(["twins"]);
    expect(banishAllPlan(s.review!, ["leaky-cache"], []).find((p) => p.file.id === "leaky-cache")!.apply).toHaveLength(4);
  });

  it("applies them all, across files, and one undo restores everything", () => {
    let s = start(reviewFromSamples());
    const ids = s.review!.files.map((f) => f.id);
    const before = s.review!.files.map((f) => f.code);
    s = reviewReducer(s, { type: "banishAll", fileIds: ids, skipKinds: REVIEW_FIRST });
    const all = s.review!.files.flatMap((f) => f.findings);
    expect(statsOf(all)).toMatchObject({ banished: 13, lurking: 1 });
    // Fixed code really is fixed: re-scanning finds only the skipped race.
    expect(s.review!.files.flatMap((f) => scan(f.code, f.language)).map((f) => f.kind)).toEqual(["twins"]);
    expect(s.undo.at(-1)!.label).toBe("Banished 13 monsters at once");
    s = reviewReducer(s, { type: "undo" });
    expect(s.review!.files.map((f) => f.code)).toEqual(before);
    expect(statsOf(s.review!.files.flatMap((f) => f.findings)).lurking).toBe(14);
  });

  it("can stay within one file", () => {
    let s = start(reviewFromSamples("haunted-api"));
    s = reviewReducer(s, { type: "banishAll", fileIds: ["haunted-api"], skipKinds: REVIEW_FIRST });
    const byFile = Object.fromEntries(s.review!.files.map((f) => [f.id, statsOf(f.findings).banished]));
    expect(byFile).toEqual({ "cursed-login": 0, "leaky-cache": 0, "haunted-api": 4 });
  });
});

describe("sending fixes to GitHub", () => {
  it("knows where fixes can go", () => {
    expect(fixDestination(reviewFromScan(fixtureScan()))).toEqual({ mode: "newBranch", owner: "acme", repo: "shop", baseBranch: "main", baseSha: "d".repeat(40) });
    expect(fixDestination(reviewFromPullRequest(fixturePullRequest()))).toMatchObject({ mode: "prBranch", number: 42, headSha: "c".repeat(40), branch: "feat/session-cache" });
    expect(fixDestination(reviewFromScan(fixtureScan({ target: "commit", ref: "d".repeat(40) }))).mode).toBeNull();
    expect(fixDestination(reviewFromSamples()).mode).toBeNull();
  });

  it("builds one commit per changed file, and a PR that lists every fix", async () => {
    let s = start(reviewFromScan(fixtureScan()));
    const login = s.review!.files.find((f) => f.path.endsWith("cursed-login.js"))!;
    s = reviewReducer(s, { type: "banish", findingId: `${login.id}:possessor:5` });
    s = reviewReducer(s, { type: "banish", findingId: `${login.id}:gremlin:7` });
    const changed = changedFiles(s.review!);
    expect(changed).toHaveLength(1);
    expect(changed[0].message).toBe(
      "Banish 2 monsters in cursed-login.js\n\n- Possessor · SQL injection (line 5, HIGH)\n- Gremlin · Hardcoded secret (line 7, HIGH)\n\nFixed with Cursed Code Review",
    );
    expect(fixPrTitle(s.review!)).toBe("🔥 Banish 2 monsters");
    const body = fixPrBody(s.review!);
    expect(body).toContain("### `src/auth/cursed-login.js`");
    expect(body).toContain("- [x] **Gremlin · Hardcoded secret** (HIGH), line 7");
    expect(body).toContain("> Set API_KEY in your environment");
    expect(body).toContain("**Not changed:** 12 monsters");
    expect(defaultBranchName(s.review!, new Date("2026-11-05T10:00:00Z"))).toBe("cursed-fixes/2026-11-05-ddddddd");
    expect(await sha256Hex("a\r\nb")).toBe(await sha256Hex("a\nb"));
  });
});
