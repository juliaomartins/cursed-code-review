# Requirements — Testing and Quality Assurance

## Problem
A review tool that breaks silently does harm. Every rule, fix and workflow needs a test that would catch its regression, and the documentation must not drift from the code.

## Goals
Fast local feedback, the same checks in CI, and specs that can be checked against the code.

## Functional requirements
- **QA-1** `npm test` SHALL run all unit, component and server tests.
- **QA-2** Every detection rule SHALL have vulnerable and lookalike-safe examples in the rule corpus.
- **QA-3** Fix-engine invariants SHALL be checked by property tests over generated files.
- **QA-4** Main journeys SHALL be covered by Playwright on desktop and Pixel 7 (`npm run test:e2e`).
- **QA-5** CI SHALL run lint, typecheck, unit tests, the Kiro consistency check, the build and e2e on every pull request.
- **QA-6** `npm run check:kiro` SHALL fail when a hook references a missing script or matches no file, a steering file has invalid front matter, a spec misses a file, a requirement is missing from the traceability matrix, or a referenced file or test does not exist.
- **QA-7** Every bug found SHALL get a regression test.

## Non-functional requirements
No test is weakened to make a change pass; fake credentials in tests are built from fragments (`src/test/fakeSecrets.ts`).

## Testing
This spec is verified by the commands themselves; see TRACEABILITY.md.
