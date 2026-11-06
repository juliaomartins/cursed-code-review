import { describe, expect, it } from "vitest";
import { seeded } from "../horror";
import { applyFix, relocate } from "../review/apply";
import { reviewFromPaste } from "../review/factory";
import { initialState, reviewReducer } from "../review/reducer";
import { rescanFile, verifyFix } from "../review/verify";
import { scan, toLines } from "../scanner";
import type { Finding } from "../types";

/**
 * Property tests for the fix engine, with a seeded generator (no extra dependency): many random files built
 * from vulnerable and harmless lines in random order. Each property must hold for every case.
 */
const VULNERABLE = [
  "  db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);",
  "  for (let i = 0; i <= items.length; i++) total += items[i];",
  "  const apiKey = 'AKIAABCDEFGHIJKLMNOP';",
  "  el.innerHTML = userBio;",
  "  https.request({ host, rejectUnauthorized: false });",
];
const HARMLESS = ["  const x = compute(a, b);", "  // a comment with SELECT * FROM t", '  log("for (i = 0; i <= n.length)");', "  total += 1;", ""];

function randomFile(seed: number): string {
  const n = 6 + Math.floor(seeded(seed, 0) * 14);
  const body = Array.from({ length: n }, (_, i) => {
    const r = seeded(seed, i + 1);
    const pool = r < 0.35 ? VULNERABLE : HARMLESS;
    return pool[Math.floor(seeded(seed, i + 100) * pool.length)];
  });
  return ["function handler(req, items, el, db, https, host, userBio) {", "  let total = 0;", ...body, "  return total;", "}"].join("\n");
}

const CASES = Array.from({ length: 60 }, (_, i) => i + 1);

describe("fix engine properties", () => {
  it("a fix changes only its own lines; everything else is byte-for-byte unchanged", () => {
    for (const seed of CASES) {
      const code = randomFile(seed);
      for (const f of scan(code, "javascript").filter((x) => x.autofix !== false)) {
        const res = applyFix(code, f);
        expect(res, `seed ${seed} ${f.id}`).not.toBeNull();
        const a = toLines(code);
        const b = toLines(res!.code);
        expect(b.slice(0, res!.start - 1)).toEqual(a.slice(0, res!.start - 1));
        expect(b.slice(res!.start - 1 + res!.added)).toEqual(a.slice(res!.start - 1 + res!.removed));
        expect(b.slice(res!.start - 1, res!.start - 1 + res!.added)).toEqual(f.fix.after);
      }
    }
  });

  it("undo restores the exact original content after any sequence of banishes", () => {
    for (const seed of CASES) {
      const review = reviewFromPaste(randomFile(seed), "javascript");
      let s = reviewReducer(initialState, { type: "start", review });
      const original = s.review!.files[0].code;
      const ids = s.review!.files[0].findings.filter((f) => f.autofix !== false).map((f) => f.id);
      for (const id of ids) s = reviewReducer(s, { type: "banish", findingId: id });
      for (let k = 0; k < ids.length; k++) s = reviewReducer(s, { type: "undo" });
      expect(s.review!.files[0].code, `seed ${seed}`).toBe(original);
      expect(s.review!.files[0].findings.every((f) => f.status === "lurking")).toBe(true);
    }
  });

  it("a fix aimed at code that is gone is rejected, never applied somewhere else", () => {
    for (const seed of CASES) {
      const code = randomFile(seed);
      for (const f of scan(code, "javascript").filter((x) => x.autofix !== false)) {
        // Someone rewrote the target lines.
        const lines = toLines(code);
        f.fix.before.forEach((_, k) => (lines[f.fix.startLine - 1 + k] = `  rewritten_${k}();`));
        const edited = lines.join("\n");
        expect(applyFix(edited, f), `seed ${seed} ${f.id}`).toBeNull();
        // Re-locating never moves it onto an identical line that belongs to another finding.
        const all = scan(code, "javascript");
        const moved = relocate(edited, all).find((x) => x.id === f.id)!;
        const others = all.filter((x) => x.id !== f.id && x.ruleId === f.ruleId).map((x) => x.fix.startLine);
        expect(moved.stale || !others.includes(moved.fix.startLine), `seed ${seed} ${f.id}`).toBe(true);
      }
    }
  });

  it("invalid patches are rejected: manual findings and out-of-range targets", () => {
    const code = "const { exec } = require('child_process');\nexec(`ls ${dir}`);";
    const manual = scan(code, "javascript").find((f) => f.ruleId === "command-injection")!;
    expect(applyFix(code, manual)).toBeNull();
    const bogus: Finding = { ...manual, autofix: true, fix: { startLine: 999, before: ["not here"], after: ["x"] } };
    expect(applyFix(code, bogus)).toBeNull();
  });

  it("a fix that resolves the finding is not reported again, and verification says so", () => {
    for (const seed of CASES) {
      const code = randomFile(seed);
      for (const f of scan(code, "javascript").filter((x) => x.autofix !== false)) {
        const res = applyFix(code, f)!;
        expect(verifyFix({ language: "javascript" }, res.code, f, res), `seed ${seed} ${f.ruleId}`).toBe("resolved");
      }
    }
  });

  it("re-scanning after a fix keeps history, keeps dismissals, and finds nothing new", () => {
    for (const seed of CASES.slice(0, 20)) {
      let s = reviewReducer(initialState, { type: "start", review: reviewFromPaste(randomFile(seed), "javascript") });
      const fs = s.review!.files[0].findings;
      if (fs.length < 2) continue;
      s = reviewReducer(s, { type: "banish", findingId: fs[0].id });
      s = reviewReducer(s, { type: "ignore", findingId: fs[1].id, reason: "accepted-risk" });
      const before = s.review!.files[0];
      const r = rescanFile(before);
      expect(r.added, `seed ${seed}`).toBe(0);
      expect(r.file.findings.find((f) => f.id === fs[0].id)?.status).toBe("banished");
      expect(r.file.findings.find((f) => f.id === fs[1].id)).toMatchObject({ status: "ignored", ignoreReason: "accepted-risk" });
      expect(r.remaining).toBe(before.findings.filter((f) => f.status === "lurking").length);
    }
  });
});
