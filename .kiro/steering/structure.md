---
inclusion: always
---
# Structure

## Repository
- `src/app/` routes: `/` home, `/crypt`, `/map`, `/report`, `/bestiary`, `/setup`; `src/app/api/` GitHub routes.
- `src/components/` by area: `home/`, `crypt/`, `map/`, `report/`, `fx/` (creature life cycle), `layout/`, `auth/`, `setup/`, `ui/` primitives; `monster-art.tsx` / `living-art.tsx` hold the seven creatures.
- `src/lib/scanner/` detection engine; `src/lib/review/` fix engine, reducer, verification, priority; `src/lib/report.ts` exports.
- `src/server/` GitHub App: session, API client, scans, fixes, diagnostics, setup.
- `src/providers/` review store and auth context.
- Tests in `__tests__/` next to their area; e2e in `e2e/`; Kiro checker in `scripts/check-kiro.mjs`.

## Data flow
1. A door (`components/home/`) produces source code: sample, paste, or GitHub (`/api/github/scan` → `server/scan.ts`).
2. `lib/review/factory.ts` scans each file (`lib/scanner`) into a `Review` and the provider starts it.
3. The crypt dispatches actions (`banish`, `ignore`, `restore`, `rescanFile`, `banishAll`, `undo`) to `lib/review/reducer.ts`; the provider dry-runs a fix before animating.
4. The report renders `lib/report.ts` and can send results back through `/api/github/{review,issue,fixes}`.

## Scanner architecture
`scanDetailed` → split lines → `lexer.ts` masks comments/strings → rule families (`injection`, `security`, `secrets`, `nullAccess`, `offByOne`, `race`, `memoryLeak`, `errors`, `deadCode`) → dedupe, PR filter, `ccr-ignore`, metadata from `rules.ts`, evidence-based severity.

## Fix engine architecture
`apply.ts` (strict `applyFix`, duplicate-aware `relocate`) → reducer snapshots for undo → `verify.ts` (`verifyFix` re-scan, `rescanFile` one-to-one pairing) → `bulk.ts` for Banish all.

## Integration boundaries
- Browser ↔ server only through `/api/*` JSON; the browser never holds a GitHub token.
- `src/lib/` has no network or DOM dependencies except `githubLive.ts` (fetch to our API), `sound.ts` and `storage.ts`.
