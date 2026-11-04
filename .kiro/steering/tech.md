---
inclusion: always
---
# Tech

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`@theme` tokens in `src/app/globals.css`).
- Frontend-only prototype: GitHub and AI are mocked in `src/lib/github.ts` and the rule-based scanner in `src/lib/scanner/`.
- State: `useReducer` in `ReviewProvider`, persisted to localStorage. All business logic lives in pure modules under `src/lib/` so it is unit-testable.
- Fixes are line-range replacements (`Fix.before` → `Fix.after`). After any edit, every other monster is re-located by content (`relocate`), never by line number alone.
- Tests: Vitest + Testing Library (`npm test`), Playwright e2e on desktop and Pixel 7 (`npm run test:e2e`).
- Fonts: Grenze Gotisch (display), Space Grotesk (UI), JetBrains Mono (code, ligatures OFF so `<=` stays visible).
- Accessibility: 44px touch targets, real buttons/links, focus-visible ember outline, `prefers-reduced-motion` honoured.
