# Requirements — Safe Automatic Fix Engine

## Problem
An automatic fix that lands on the wrong line, or claims success when nothing changed, is worse than no fix. Developers must be able to review, apply, undo and verify every change.

## Goals
- Every fix is reviewable (before/after), targeted, reversible and verified.
- When no safe automatic fix exists, say so and explain the manual fix.

## Functional requirements
- **FIX-1** A fix SHALL be applied only when its target lines sit exactly at the finding's start line (trimmed comparison); otherwise it SHALL be rejected.
- **FIX-2** A fix SHALL change only its own lines; every other line SHALL stay byte-identical.
- **FIX-3** WHEN a fix inserts or removes lines THEN other findings SHALL move with their code; an occurrence of identical code SHALL belong to one finding only.
- **FIX-4** IF a finding's code disappeared THEN it SHALL be marked stale and cannot be banished.
- **FIX-5** The banishment SHALL start only after a dry run confirms the fix applies; IF it does not THEN the UI SHALL say the creature resists and SHALL NOT report success.
- **FIX-6** WHEN a fix is applied THEN the system SHALL re-scan the fixed code and record whether the same rule still fires on the changed lines.
- **FIX-7** Findings without a safe automatic fix SHALL never change code, and SHALL show remediation guidance.
- **FIX-8** Undo SHALL restore the exact previous code, statuses and selection, after any sequence of actions.
- **FIX-9** "Banish all" SHALL preview the plan, skip stale, manual and Twin Ghosts fixes unless included, apply across files, and undo in one step.
- **FIX-10** Re-scanning a file SHALL keep banished history, pair each fresh finding with at most one known finding (same rule and code, nearest line) so a dismissal never spreads, and report resolved / new / remaining.
- **FIX-11** WHEN indentation around a target changed THEN the replacement SHALL be re-indented to match.

## Non-functional requirements
Pure functions (`apply.ts`, `verify.ts`, `bulk.ts`) driven by the reducer; no I/O.

## Edge cases
Two identical vulnerable lines; a fix whose lines were rewritten; deletion fixes (Zombie); multi-line fixes (Twin Ghosts); CRLF files.

## Security
The original source is kept (`originalCode`, `initialFindings`) so it can always be inspected or restored.

## Testing
Property tests over generated files (`fixEngine.property.test.ts`) assert FIX-1, FIX-2, FIX-6, FIX-8, FIX-10 for every case; example tests cover the rest.
