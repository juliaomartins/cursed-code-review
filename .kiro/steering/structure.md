---
inclusion: always
---
# Structure

- `src/app/` routes: `/` home, `/crypt` review workspace, `/report`, `/bestiary`.
- `src/components/` UI by area (`home/`, `crypt/`, `report/`, `layout/`, `auth/`, `ui/` primitives). `Monster.tsx` + `monster-art.tsx` hold the 7 SVG monsters from the design board.
- `src/lib/scanner/` one file per monster rule; `index.ts` runs them all.
- `src/lib/review/` fix engine (`apply.ts`), reducer, selectors, review factories.
- `src/providers/` client context (review store, mock auth).
- Tests sit next to their area in `__tests__/`; e2e in `e2e/`.
