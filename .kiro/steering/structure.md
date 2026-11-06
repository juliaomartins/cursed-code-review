---
inclusion: always
---
# Structure

- `src/app/` routes: `/` home, `/crypt` review workspace, `/map` Haunted Map, `/report`, `/bestiary`, `/setup`; `src/app/api/` GitHub routes.
- `src/components/` UI by area (`home/`, `crypt/`, `map/`, `report/`, `fx/`, `layout/`, `auth/`, `ui/` primitives). `Monster.tsx` + `monster-art.tsx` / `living-art.tsx` hold the 7 monsters.
- `src/lib/scanner/`: `lexer.ts` (comment/string masking), `rules.ts` (rule registry and metadata), one module per rule family (`injection.ts`, `security.ts`, `secrets.ts`, `nullAccess.ts`, `offByOne.ts`, `race.ts`, `memoryLeak.ts`, `errors.ts`, `deadCode.ts`), `index.ts` runs them (`scan`, `scanDetailed`).
- `src/lib/review/`: fix engine (`apply.ts`), verification and re-scan (`verify.ts`), prioritisation (`priority.ts`), reducer, selectors, bulk banish, review factories.
- `src/lib/report.ts`: Markdown report, PR review comments, GitHub issue body (all redacted).
- `src/server/`: GitHub App session, API client, scan/fix routes logic.
- `src/providers/`: client context (review store, auth).
- Tests sit next to their area in `__tests__/`; e2e in `e2e/`.
