---
name: add-detection-rule
description: Add or change a scanner detection rule in the Cursed Code Review engine, with corpus tests and traceability. Use when adding a new rule, editing an existing rule family, changing the lexer, tuning severity or confidence, or fixing a false positive or false negative in src/lib/scanner.
---

# Add or change a detection rule

Authoritative invariants live in `.kiro/steering/scanner-rules.md`, which Kiro loads
automatically whenever a file under `src/lib/scanner/**` is in context. Read it first and
follow it; this skill is the running order, not a copy of the rules.

Architecture reference: `.kiro/steering/structure.md` ("Scanner architecture").
Requirements: `.kiro/specs/02-detection-engine/requirements.md` (DET-*).

## 1. Decide where the rule belongs

Rule families each own a file in `src/lib/scanner/`: `injection.ts`, `security.ts`,
`secrets.ts`, `nullAccess.ts`, `offByOne.ts`, `race.ts`, `memoryLeak.ts`, `errors.ts`,
`deadCode.ts`. Extend the matching family rather than creating a new file. The pipeline that
calls them is `scanDetailed` in `src/lib/scanner/index.ts`.

## 2. Match on masked code, never on raw text

`src/lib/scanner/lexer.ts` (`maskSource`) blanks comment bodies and string contents while
preserving line length and column positions. Match against the masked line (`code[i]`), so a
finding can never come from a comment or a string literal.

Build the replacement from the *original* line, and only when the matched text is identical in
both the masked and the original line.

Set `column` to where the problem starts, 1-based.

A rule must never throw. `scanDetailed` contains failures, but a crash silently hides findings.

## 3. Register the rule in RULES_META

Every rule needs an entry in `RULES_META` in `src/lib/scanner/rules.ts`. The `RuleMeta`
interface at the top of that file is the contract; fill in each field:

- `id`, `title`, `kind` (the monster), `category`
- `cwe`, and `owasp` when a Top 10 (2021) entry applies
- `confidence` — the default confidence
- `impact` — what goes wrong in the running application
- `remediation` — what the developer should do, in general terms
- `autofix` — `false` when the rule never produces a safe automatic fix
- `languages` — **only** the languages the tests actually cover

## 4. Severity needs evidence, not a guess

`CRITICAL` requires evidence on the line itself: `exposure: "untrusted-input"` (from
`UNTRUSTED`) or a live-format key. Never infer reachability.

When the rule cannot confirm a real risk, set confidence `low` and say why in the explanation.

If there is no safe automatic fix, set `autofix: false`, put the guidance in `fix.note`, and
make `fix.after` equal `fix.before`. The fix engine never applies these — see
`.kiro/steering/fix-engine.md`.

## 5. Add corpus cases to the accuracy test

In `src/lib/__tests__/accuracy.test.ts`, under the describe block
`"rule corpus: vulnerable code is found, lookalikes are not"`, add at minimum:

1. a **vulnerable** example the rule must flag — `expect(rules(...)).toContain("your-rule-id")`
2. a **lookalike-safe** example it must not flag — `expect(rules(...)).toEqual([])`
   (for example UI text that merely contains a keyword, or an already-parameterised call)
3. the same construct inside a **comment or string**, which must produce nothing

Zero false positives on the lookalike-safe examples is a product success criterion. If a case
fails, fix the rule, never the expectation.

Fake credentials must come from `src/test/fakeSecrets.ts` (`FAKE`), which assembles them from
fragments so secret scanners stay quiet. Never paste a realistic-looking literal secret.

## 6. Update the spec and the traceability matrix

Add or amend the DET requirement in `.kiro/specs/02-detection-engine/requirements.md`, keeping
the existing id style (`**DET-n**`) and EARS phrasing. Do not renumber existing ids.

Then add or update the row in `.kiro/specs/TRACEABILITY.md`:

```
| DET-n | Short requirement summary | `src/lib/scanner/<family>.ts` | `src/lib/__tests__/accuracy.test.ts` › "your exact test name" | ✅ |
```

The test name must match the `it(...)` string character for character — `check:kiro` greps the
file for it. Use ✅ only with a passing test, 🟡 for partial with the limitation stated, ❌ for
not implemented.

## 7. Verify

```
npm run test:scanner
npm run check:kiro
```

`test:scanner` runs `accuracy.test.ts` and `scanner.test.ts`; `check:kiro` proves the spec,
matrix and hook wiring still line up. Both must pass before you hand the change over.
