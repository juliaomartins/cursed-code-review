# Design — Safe Fix Engine

- `src/lib/review/apply.ts`: `targetsCurrentCode` + `applyFix` (strict, re-indent), `relocate` (claims occurrences: findings already in place first, others move to the nearest unclaimed one or go stale).
- `src/lib/review/verify.ts`: `verifyFix` (re-scan, `resolved` / `still-detected`), `rescanFile` (one-to-one pairing).
- `src/lib/review/reducer.ts`: `banish` (verify, relocate, undo snapshot), `ignore` (reason), `restore`, `rescanFile`, `banishAll`, `undo`.
- `src/lib/review/bulk.ts`: plan and apply "Banish all".
- `src/providers/ReviewProvider.tsx`: dry run before `beginBanish`; returns the banishment length or `false`.
