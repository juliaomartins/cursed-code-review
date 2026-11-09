---
inclusion: always
---
# Product: Mateklamar Code Review

## Vision
A code review you can see and trust. Every bug is a monster on the exact line where it hides; every fix is a banishment that really changes the code; every victory brings daylight.

## Target users
- Developers reviewing a pull request, a file or a whole repository (JavaScript, TypeScript, Python, PHP).
- Kiroween judges, who must reach monsters in one click (cursed samples on the home page).

## Core problems
- Review output is skimmed and forgotten → findings become creatures on their lines.
- Static-analysis noise erodes trust → code-only matching, honest confidence, evidence-based severity.
- Automatic fixes can be unsafe → strict targeting, verification by re-scan, undo, manual guidance when no safe fix exists.

## UX principles
- The theme decorates, it never obscures: severity, rule, line:column and the fix are always readable.
- Every explanation has a technical version ("What is wrong", with impact and how to fix) and an "Explain it simply" version.
- Every action is reviewable before and reversible after (diff preview, undo, dismiss with reason).
- Spooky but calm: motion and sound are optional and respect reduced motion; sound is off by default.
- Say what we don't know: low confidence and "no safe automatic fix" are shown, not hidden.

## Success criteria
- Findings that are fixed show "verified by re-scan".
- The rule corpus has zero false positives on its lookalike-safe examples.
- Lint (with accessibility rules), typecheck, `npm run check:kiro`, unit/component/server tests and e2e all pass in CI.
