import { describe, expect, it } from "vitest";
import { applyFix, locate, relocate } from "../review/apply";
import { reviewFromPaste, reviewFromSamples } from "../review/factory";
import { initialState, reviewReducer, type ReviewState } from "../review/reducer";
import { activeFile, nextLurking, reviewStats, statsOf, worstSeverity } from "../review/selectors";
import { scan, toLines } from "../scanner";

const started = (): ReviewState => reviewReducer(initialState, { type: "start", review: reviewFromSamples("cursed-login") });
const file = (s: ReviewState) => activeFile(s.review!);
const byKind = (s: ReviewState, kind: string) => file(s).findings.find((f) => f.kind === kind)!;

describe("fix engine", () => {
  it("locates code by trimmed text, preferring the nearest match", () => {
    const lines = ["a", "  x", "b", "x"];
    expect(locate(lines, { startLine: 4, before: ["x"], after: [] })).toBe(4);
    expect(locate(lines, { startLine: 1, before: ["x"], after: [] })).toBe(2);
    expect(locate(lines, { startLine: 1, before: ["nope"], after: [] })).toBeNull();
  });

  it("applies a fix and re-indents when indentation changed", () => {
    const code = "    for (let i = 0; i <= xs.length; i++) {}\n}";
    const [f] = scan("for (let i = 0; i <= xs.length; i++) {}", "javascript");
    const res = applyFix(code, f)!;
    expect(res.code.split("\n")[0]).toBe("    for (let i = 0; i < xs.length; i++) {}");
  });

  it("refuses a fix whose target is not exactly where the finding says (regression: no guessing)", () => {
    // Same code, but on line 2 instead of line 1: this is not the source the finding was made from.
    const code = "if (a) {\n    for (let i = 0; i <= xs.length; i++) {}\n}";
    const [f] = scan("for (let i = 0; i <= xs.length; i++) {}", "javascript");
    expect(applyFix(code, f)).toBeNull();
  });

  it("re-locates other monsters after lines are inserted above them", () => {
    const s = started();
    const f = file(s);
    const leech = f.findings.find((x) => x.kind === "leech")!;
    const res = applyFix(f.code, leech)!; // inserts one line after line 12
    const moved = relocate(res.code, f.findings, res);
    expect(moved.find((x) => x.kind === "zombie")!.fix.startLine).toBe(16);
    expect(moved.find((x) => x.kind === "imp")!.fix.startLine).toBe(11);
  });
});

describe("review reducer", () => {
  it("starts with the requested sample active and its first monster selected", () => {
    const s = started();
    expect(s.review!.files).toHaveLength(3);
    expect(s.review!.activeFileId).toBe("cursed-login");
    expect(s.review!.selectedFindingId).toBe("cursed-login:possessor:5");
  });

  it("banishing applies the fix, lights the room and selects the next monster", () => {
    let s = started();
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:possessor:5" });
    const f = file(s);
    expect(toLines(f.code)[4]).toBe("    'SELECT * FROM users WHERE name = $1', [req.body.name]");
    expect(f.findings.find((x) => x.kind === "possessor")!.status).toBe("banished");
    expect(s.review!.selectedFindingId).toBe("cursed-login:gremlin:7");
    expect(statsOf(f.findings).light).toBe(38);
    expect(s.undo).toHaveLength(1);
  });

  it("banishing every monster leaves clean code and a fully lit room", () => {
    let s = started();
    for (const f of [...file(s).findings]) s = reviewReducer(s, { type: "banish", findingId: f.id });
    const f = file(s);
    expect(statsOf(f.findings)).toMatchObject({ lurking: 0, banished: 6, light: 100 });
    expect(f.code).not.toMatch(/console\.log|sk-live|<= items|user\.profile\.email|\$\{req/);
    expect(scan(f.code, "javascript")).toEqual([]);
    expect(s.review!.selectedFindingId).toBeNull();
  });

  it("banishing twin ghosts wraps both lines and keeps later monsters reachable", () => {
    let s = reviewReducer(started(), { type: "selectFile", fileId: "leaky-cache" });
    const twins = byKind(s, "twins");
    s = reviewReducer(s, { type: "banish", findingId: twins.id });
    const lines = toLines(file(s).code);
    expect(lines[13]).toBe("    with _balance_lock:");
    expect(lines[16]).toBe("            set_balance(account, balance - amount)");
    const wraith = byKind(s, "wraith");
    expect(wraith.fix.startLine).toBe(23);
    s = reviewReducer(s, { type: "banish", findingId: wraith.id });
    expect(toLines(file(s).code)[22]).toBe("    token = match.group(1) if match else None");
  });

  it("ignoring keeps the code but resolves the monster without adding light", () => {
    let s = started();
    const before = file(s).code;
    s = reviewReducer(s, { type: "ignore", findingId: "cursed-login:zombie:15" });
    expect(file(s).code).toBe(before);
    expect(statsOf(file(s).findings)).toMatchObject({ ignored: 1, lurking: 5, light: 25 });
  });

  it("restores an ignored monster", () => {
    let s = reviewReducer(started(), { type: "ignore", findingId: "cursed-login:zombie:15" });
    s = reviewReducer(s, { type: "restore", findingId: "cursed-login:zombie:15" });
    expect(byKind(s, "zombie").status).toBe("lurking");
    expect(s.review!.selectedFindingId).toBe("cursed-login:zombie:15");
  });

  it("undo restores code, statuses and selection", () => {
    let s = started();
    const original = file(s).code;
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:possessor:5" });
    s = reviewReducer(s, { type: "undo" });
    expect(file(s).code).toBe(original);
    expect(byKind(s, "possessor").status).toBe("lurking");
    expect(s.review!.selectedFindingId).toBe("cursed-login:possessor:5");
    expect(s.undo).toHaveLength(0);
    expect(reviewReducer(s, { type: "undo" })).toBe(s);
  });

  it("reset summons every monster again from the original code", () => {
    let s = started();
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:possessor:5" });
    s = reviewReducer(s, { type: "ignore", findingId: "cursed-login:gremlin:7" });
    s = reviewReducer(s, { type: "resetFile", fileId: "cursed-login" });
    expect(file(s).code).toBe(file(s).originalCode);
    expect(statsOf(file(s).findings).lurking).toBe(6);
  });

  it("marks a monster stale when its code disappeared", () => {
    let s = started();
    const review = s.review!;
    const tampered = { ...review, files: review.files.map((f) => (f.id === "cursed-login" ? { ...f, code: f.code.replace("console.log('done');", "") } : f)) };
    s = { ...s, review: tampered };
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:zombie:15" });
    expect(byKind(s, "zombie")).toMatchObject({ status: "lurking", stale: true });
  });

  it("steps through monsters in reading order, wrapping around", () => {
    let s = started();
    s = reviewReducer(s, { type: "step", direction: -1 });
    expect(s.review!.selectedFindingId).toBe("cursed-login:zombie:15");
    s = reviewReducer(s, { type: "step", direction: 1 });
    expect(s.review!.selectedFindingId).toBe("cursed-login:possessor:5");
  });

  it("switching files selects that file's first lurking monster", () => {
    const s = reviewReducer(started(), { type: "selectFile", fileId: "haunted-api" });
    expect(s.review!.selectedFindingId).toBe("haunted-api:imp:15");
  });

  it("does nothing without a review", () => {
    expect(reviewReducer(initialState, { type: "undo" })).toBe(initialState);
  });
});

describe("selectors", () => {
  it("computes review-wide stats and the worst severity", () => {
    const s = started();
    expect(reviewStats(s.review!)).toMatchObject({ total: 14, lurking: 14, light: 25 });
    // The sample's SQL injection takes req.body.name: untrusted input reaching the query is CRITICAL.
    expect(worstSeverity(s.review!.files.flatMap((f) => f.findings))).toBe("CRITICAL");
    expect(worstSeverity([])).toBeNull();
  });

  it("treats a file without monsters as fully lit", () => {
    const r = reviewFromPaste("const a = 1;\n", "javascript");
    expect(statsOf(r.files[0].findings)).toMatchObject({ total: 0, light: 100 });
    expect(r.selectedFindingId).toBeNull();
    expect(r.files[0].path).toBe("pasted.js");
  });

  it("finds the next lurking monster after a resolved one", () => {
    let s = started();
    s = reviewReducer(s, { type: "ignore", findingId: "cursed-login:wraith:8" });
    expect(nextLurking(file(s), "cursed-login:wraith:8")!.id).toBe("cursed-login:imp:11");
  });
});
