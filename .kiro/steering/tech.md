---
inclusion: always
---
# Tech

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`@theme` tokens in `src/app/globals.css`).
- Real GitHub integration through a GitHub App (server routes under `src/app/api/`, logic in `src/server/`); tokens stay server-side in an encrypted HTTP-only cookie. Public repos work signed out. No AI: every finding comes from the rule-based scanner.
- State: `useReducer` in `ReviewProvider`, persisted to localStorage. All business logic lives in pure modules under `src/lib/` so it is unit-testable.

## Scanner conventions
- Rules never match raw text alone. `scanner/lexer.ts` masks comments and string contents (same columns); a rule matches on the masked line and only builds its fix from the original text.
- Every rule has an entry in `scanner/rules.ts` (`RULES_META`): id, category, CWE/OWASP, default confidence, impact, remediation, whether an automatic fix exists, supported languages. A language is only listed when tests cover it.
- Severity is evidence-based: CRITICAL only when untrusted input is visible on the line (request data, argv…) reaching an injection sink, or for a live-format credential. Exposure is never guessed.
- Confidence "low" means a potential risk the scanner could not confirm, and the explanation says so.
- One finding per rule per line. `ccr-ignore` / `ccr-ignore: rule-id` comments suppress findings (comments only, never strings).
- A rule must not throw: `scanDetailed` catches rule errors, skips lines over 2,000 characters and reports what it skipped.

## Fix-engine safety rules
- Fixes are line-range replacements (`Fix.before` → `Fix.after`). `applyFix` is strict: the target must sit exactly at `fix.startLine`; it never searches elsewhere (identical lines may belong to other findings).
- After any edit, every other finding is re-located (`relocate`), and an occurrence of identical code is claimed by one finding only. Findings whose code disappeared become stale and cannot be banished.
- The provider dry-runs a fix before any banishment animation; a fix that does not apply is shown as "resists", never as success.
- After a fix lands, the reducer re-scans the fixed code (`verifyFix`) and records `resolved` / `still-detected`.
- Rules without a safe automatic fix (`autofix: false`) never change code; they give remediation and can be dismissed with a reason.
- Reports, issues and review comments pass through `redactSecrets`.

## Tests
- Vitest + Testing Library (`npm test`): rule corpus with vulnerable and lookalike-safe code (`accuracy.test.ts`), fix-engine property tests with a seeded generator (`fixEngine.property.test.ts`), component and server tests. Playwright e2e on desktop and Pixel 7 (`npm run test:e2e`). CI runs all of it (`.github/workflows/ci.yml`).
- Never weaken a test to make a change pass; add a regression test for every bug found.

## UI
- Fonts: Grenze Gotisch (display), Space Grotesk (UI), JetBrains Mono (code, ligatures OFF so `<=` stays visible).
- Accessibility: 44px touch targets, real buttons/links, focus-visible ember outline, `prefers-reduced-motion` honoured. The horror presentation (`lib/horror.ts`, `components/fx/`) never touches review state.
