---
inclusion: always
---
# Tech

## Architecture
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`@theme` tokens in `src/app/globals.css`; Daybreak re-defines tokens under `html[data-daybreak]`).
- Browser: scanning, fixing and review state run client-side in pure modules under `src/lib/`. State lives in `ReviewProvider` (`useReducer`) and is persisted to localStorage.
- Server: GitHub App integration in `src/server/` behind thin routes in `src/app/api/`. Tokens never reach the browser.
- No AI calls: every finding comes from the rule engine.

## Coding conventions
- Business logic in pure, unit-tested functions; components only render and dispatch.
- Presentation (`lib/horror.ts`, `components/fx/`, `lib/sound.ts`) never changes review state.
- Real `<button>`/`<a>` elements; icon-only controls need `aria-label`.
- No new runtime dependency without a reason written in the PR.
- Scanner and fix-engine rules: see the focused steering files `scanner-rules.md` and `fix-engine.md`.

## Security
- GitHub tokens: sealed (AES-GCM), HTTP-only cookie; `state` checked on OAuth callback; relative return paths only.
- Never log or export secrets: reports, issues and PR comments go through `redactSecrets`.
- Fake credentials in tests are built from fragments (`src/test/fakeSecrets.ts`) so secret scanners stay quiet.
- No `eval`, no shell execution, no code from the scanned repository is ever run.

## Performance
- Scan 1,500 lines in under 3 s; lines over 2,000 chars are skipped.
- Repository scans: at most 40 files, contents from raw.githubusercontent.com (outside the API limit).
- Animation in CSS/SVG; one shared pointer listener for all creatures; no continuous WebGL.

## Testing standards
- `npm run verify` before pushing (lint incl. jsx-a11y, typecheck, `check:kiro`, tests); `npm run test:e2e` for UI flows.
- Every requirement in `.kiro/specs/*/requirements.md` is traced in `.kiro/specs/TRACEABILITY.md` to code and tests.
- Never weaken a test to make a change pass; every bug gets a regression test.
- Fonts: JetBrains Mono for code with ligatures OFF so `<=` stays visible.
