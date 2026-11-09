---
name: safe-fix-change
description: Change the fix engine (apply, verify, relocate, bulk, reducer) without breaking its safety invariants. Use when editing anything under src/lib/review, touching applyFix, relocate, verifyFix, rescanFile, undo snapshots, Banish all, or the ReviewProvider.
---

# Change the fix engine safely

Every bullet in `.kiro/steering/fix-engine.md` is a safety property, not a style preference.
Kiro loads that file automatically whenever a file under `src/lib/review/**` is in context.
Read it before you edit, and treat it as the acceptance criteria for your change.

`src/lib/__tests__/fixEngine.property.test.ts` checks these properties against generated
files. **Never relax a property to make a change pass.**

Architecture reference: `.kiro/steering/structure.md` ("Fix engine architecture").
Requirements: `.kiro/specs/03-safe-fix-engine/requirements.md` (FIX-*).

## The invariants you must preserve

Work through these explicitly after any edit:

1. **Strict targeting.** `applyFix` applies only when `fix.before` sits exactly at
   `fix.startLine`. It never searches elsewhere for a place to land.
2. **No guessing on duplicate lines.** When identical code appears more than once, an
   occurrence is claimed by exactly one finding. A fix aimed at code that is no longer there is
   rejected outright rather than applied to a lookalike line.
3. **Minimal blast radius.** A fix changes only its own lines; every other byte of the file is
   untouched.
4. **Relocation.** After an edit, `relocate` moves the remaining findings with their code.
   Findings whose code has vanished become stale rather than mis-aimed.
5. **Manual findings never apply.** A finding with `autofix: false` must never change code, and
   is excluded from Banish all (`src/lib/review/bulk.ts`).
6. **Verification by re-scan.** Every applied fix goes through `verifyFix`
   (`src/lib/review/verify.ts`) and records `resolved` or `still-detected`. The report only
   claims "verified by re-scan" on that evidence.
7. **Undo is exact.** Every state change that alters code or statuses pushes an undo snapshot
   in `src/lib/review/reducer.ts`, and undo restores the previous content byte for byte.
8. **Re-scan pairing.** `rescanFile` keeps banished history and pairs fresh findings
   one-to-one: same rule, same code, nearest line. Dismissals survive a re-scan; a resolved
   finding is not re-reported.

## Working order

1. Identify which module owns the behaviour: `apply.ts` (locate/applyFix/relocate),
   `verify.ts` (verifyFix/rescanFile), `reducer.ts` (actions and undo snapshots),
   `bulk.ts` (Banish all), `factory.ts`, `priority.ts`, `selectors.ts`.
2. Keep the logic pure. Per `.kiro/steering/tech.md`, business logic stays in pure unit-tested
   functions; components only render and dispatch. The provider
   (`src/providers/ReviewProvider.tsx`) dry-runs a fix before animating, so never move
   decision-making into the animation path.
3. Make the change.
4. **Add a regression test for every bug**, named after the bug, in
   `src/lib/__tests__/review.test.ts` or `src/lib/__tests__/fixes.test.ts`. If the bug is a
   violated safety property, strengthen `fixEngine.property.test.ts` instead.
5. If behaviour changed on purpose, update
   `.kiro/specs/03-safe-fix-engine/requirements.md` and the FIX rows of
   `.kiro/specs/TRACEABILITY.md`, then run `npm run check:kiro`.

## Verify

```
npm run test:fix-engine
```

That runs `review.test.ts`, `fixEngine.property.test.ts` and `fixes.test.ts`. A property
failure is a safety bug: fix the code, add the regression test, and only then re-run. If you
believe a property itself is wrong, say so and ask — do not edit it quietly.
