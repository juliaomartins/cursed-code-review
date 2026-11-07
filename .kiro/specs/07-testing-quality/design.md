# Design — Testing and Quality

- Vitest (`vitest.config.mts`, jsdom; server tests opt into node) — `npm test`; focused scripts `test:scanner`, `test:fix-engine`, `test:ui`.
- Playwright (`playwright.config.ts`, desktop + Pixel 7) — `npm run test:e2e` against a production build.
- `scripts/check-kiro.mjs` — `npm run check:kiro`; also run inside `npm test` by `src/lib/__tests__/kiro.test.ts`.
- `npm run verify` = lint + typecheck + test + check:kiro. CI: `.github/workflows/ci.yml`.
