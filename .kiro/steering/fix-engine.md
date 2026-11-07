---
inclusion: fileMatch
fileMatchPattern: "src/lib/review/**"
---
# Fix-engine invariants

These are safety properties; `src/lib/__tests__/fixEngine.property.test.ts` checks them on generated files. Never relax one to make a change pass.

- `applyFix` applies only when `fix.before` sits exactly at `fix.startLine`; it never searches elsewhere.
- A fix changes only its own lines; everything else stays byte-identical.
- After any edit, `relocate` moves other findings with their code; an occurrence of identical code is claimed by one finding only; findings whose code vanished become stale.
- Findings with `autofix: false` never change code (also excluded from Banish all).
- Every applied fix is verified by `verifyFix` (re-scan) and records `resolved` / `still-detected`.
- Every state change that alters code or statuses pushes an undo snapshot; undo restores the exact previous content.
- `rescanFile` keeps banished history and pairs fresh findings one-to-one (same rule, same code, nearest line).

Run `npm run test:fix-engine` after any change here.
