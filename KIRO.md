# Kiro in Cursed Code Review

This page is the evidence package for Kiroween 2026: what the Kiro artefacts are, how they drive and check the code, and how to verify every claim yourself. Everything linked here is in this repository.

## At a glance

| Artefact | What it does | Where |
| --- | --- | --- |
| 7 specs | Problem, goals, EARS requirements with ids, non-functional requirements, edge cases, security, testing; a design and a task list each | [.kiro/specs/](.kiro/specs/) |
| Traceability matrix | Every requirement → source files → tests that verify it → status (✅ / 🟡 / ❌) | [.kiro/specs/TRACEABILITY.md](.kiro/specs/TRACEABILITY.md) |
| 5 steering files | Product, tech and structure (always on); scanner-rule and fix-engine rules (load only when editing those folders) | [.kiro/steering/](.kiro/steering/) |
| 5 hooks | Rule corpus on rule edits, safety properties on fix-engine edits, accessibility lint on UI edits, traceability check on spec/test edits, a manual quality gate | [.kiro/hooks/](.kiro/hooks/) |
| 5 skills | The repeatable workflows, as Agent Skills Kiro loads on demand: `add-detection-rule` (a scanner rule with corpus cases and a DET row), `safe-fix-change` (edit the fix engine without breaking its invariants), `new-requirement` (a feature spec-first, EARS id → design → tasks → matrix row), `ui-accessibility-pass` (design tokens, labels, reduced motion), `ship-to-production` (quality gate, feature branch, PR into `main`). Each one points at the steering, spec and test files rather than restating them | [.kiro/skills/](.kiro/skills/) |
| Consistency checker | Fails when hooks, steering, specs, the matrix or doc links drift from the code | [scripts/check-kiro.mjs](scripts/check-kiro.mjs), tested in [kiro.test.ts](src/lib/__tests__/kiro.test.ts) |
| CI | Runs lint (with accessibility rules), typecheck, the Kiro check, all tests, build, e2e on every PR | [.github/workflows/ci.yml](.github/workflows/ci.yml) |

## The specs

| Spec | Requirement ids | Implementation | Main tests |
| --- | --- | --- | --- |
| [01 Haunted Monster Experience](.kiro/specs/01-haunted-monster-experience/requirements.md) | MON-1…7 | `src/components/fx/`, `src/lib/horror.ts`, `src/lib/sound.ts` | [horror.test.tsx](src/components/__tests__/horror.test.tsx), [daybreak.test.tsx](src/components/__tests__/daybreak.test.tsx) |
| [02 Detection Engine](.kiro/specs/02-detection-engine/requirements.md) | DET-1…21 | `src/lib/scanner/` | [accuracy.test.ts](src/lib/__tests__/accuracy.test.ts), [scanner.test.ts](src/lib/__tests__/scanner.test.ts) |
| [03 Safe Fix Engine](.kiro/specs/03-safe-fix-engine/requirements.md) | FIX-1…11 | `src/lib/review/` | [fixEngine.property.test.ts](src/lib/__tests__/fixEngine.property.test.ts), [review.test.ts](src/lib/__tests__/review.test.ts) |
| [04 GitHub Integration](.kiro/specs/04-github-integration/requirements.md) | GH-1…12 | `src/server/`, `src/app/api/` | [src/server/\_\_tests\_\_/](src/server/__tests__/) |
| [05 Developer Review Experience](.kiro/specs/05-developer-review-experience/requirements.md) | DRX-1…9 | `src/components/{home,crypt,map,report}/` | [devtool.test.tsx](src/components/__tests__/devtool.test.tsx), [report.test.tsx](src/components/__tests__/report.test.tsx) |
| [06 Accessibility and Performance](.kiro/specs/06-accessibility-performance/requirements.md) | A11Y-1…7 | `eslint.config.mjs`, `src/lib/useReducedMotion.ts` | `npm run lint`, [e2e/hunt.spec.ts](e2e/hunt.spec.ts) |
| [07 Testing and Quality](.kiro/specs/07-testing-quality/requirements.md) | QA-1…7 | `scripts/check-kiro.mjs`, CI | `npm run verify` |

Requirements are written so a test can decide them, for example:

> **FIX-1** A fix SHALL be applied only when its target lines sit exactly at the finding's start line; otherwise it SHALL be rejected.

and the matrix points to the test that decides it (`review.test.ts` › "refuses a fix whose target is not exactly where the finding says (regression: no guessing)"). Unfinished work is listed, not hidden: DET-20 (unhandled promise rejections) and DET-21 (cross-file analysis) are ❌; A11Y-5 (44 px targets) and A11Y-6 (contrast) are 🟡 because no automated check exists yet.

## How the pieces work together

1. **Requirements first.** A feature starts as EARS requirements with ids in a spec's `requirements.md`, then a short `design.md` naming the files, then `tasks.md`.
2. **Steering sets the rules the agent follows while coding.** For example, [scanner-rules.md](.kiro/steering/scanner-rules.md) (loaded only for `src/lib/scanner/**`) requires matching on masked code, registering CWE/impact/remediation in `rules.ts`, evidence for CRITICAL, and a vulnerable plus a lookalike-safe corpus case for every rule. [fix-engine.md](.kiro/steering/fix-engine.md) lists the safety invariants that must never be relaxed.
3. **Hooks run the matching checks on save.** Editing a rule triggers `npm run test:scanner`; editing patch logic triggers `npm run test:fix-engine` (property tests); editing UI triggers `npm run lint:a11y` plus a review checklist; editing specs, tests or docs triggers `npm run check:kiro`. Each prompt says what to do on failure: fix the code, never weaken the test.
4. **Traceability closes the loop.** `npm run check:kiro` fails if a requirement is missing from the matrix, a referenced file or test was renamed or deleted, a ✅ row has no verification, a hook names a script that doesn't exist, or a doc link is broken. It also runs inside `npm test`, so CI enforces it.

## What the specs, steering and hooks guided (with evidence)

- **Code scanning (DET).** The spec demands code-only matching (DET-1) and lookalike-safe examples for each rule (QA-2). That is why `lexer.ts` exists and why `accuracy.test.ts` checks, for instance, that `toast(\`Please select an option, ${name}\`)` is *not* SQL injection.
- **Monster-based findings (MON, DET-15).** Each rule maps to one creature in `RULES_META`, with CWE, impact and remediation; the creature's life cycle follows the finding (MON-2…MON-5).
- **Safe fixes (FIX).** The FIX requirements became property tests over generated files. They found two real bugs: a fix could land on an identical line owned by another finding, and a re-scan could spread a dismissal to identical lines. The fixes and their regression tests are traced as FIX-1, FIX-3 and FIX-10.
- **GitHub integration (GH).** GH-8 ("never overwrite files that changed since the scan") and GH-12 ("no secrets in issues or comments") each have server or unit tests; the GH-12 test was added while building this traceability, because the matrix showed the requirement had no test yet.
- **Developer experience (DRX).** Fix first, filters, dismiss with reason and re-scan are each traced to component tests.
- **Accessibility and quality (A11Y, QA).** The jsx-a11y recommended rules run in `npm run lint`; the one deliberate exception (a focusable scrollable code region) is documented inline in `CodeView.tsx`.

## Verify it yourself

```bash
npm ci
npm run check:kiro      # Kiro artefacts vs. repository: hooks, steering, specs, traceability, links
npm run verify          # lint (incl. jsx-a11y) + typecheck + check:kiro + all unit/component/server tests
npm run test:scanner    # rule corpus: vulnerable and lookalike-safe code per rule
npm run test:fix-engine # fix-engine property tests
npm run build && npm run test:e2e   # Playwright, desktop and Pixel 7
```

To see the checker catch drift, rename a test that the matrix references (for example in `accuracy.test.ts`) and run `npm run check:kiro`: it names the requirement and the missing test.

## Provenance (what we do and don't claim)

- The code, tests and these Kiro artefacts were written in AI-assisted sessions: commits carry a `Claude-Session` trailer (Claude Code). The `.kiro/` folder is the specification and rulebook those sessions followed and kept up to date, in Kiro's formats, so the same workflow runs in the Kiro IDE.
- The git history shows how the specs evolved: one frontend spec in the first commit (`1cfc9ba`), a "trustworthy review" spec added with the scanner overhaul (`fd209ab`), then the split into seven specs with a traceability matrix and checker.
- The git history holds no record of sessions inside the Kiro IDE, and we don't claim any. There are no generated chat logs, screenshots or timestamps here.

## Steps that need the Kiro IDE

### Verified in a Kiro agent session

- ✅ **Steering inclusion works as declared.** The three `inclusion: always` files (product, tech,
  structure) were present in the agent's context from the first turn. `scanner-rules.md` was
  injected only once a file under `src/lib/scanner/**` entered context (reading
  `src/lib/scanner/rules.ts`), and `fix-engine.md` only once `src/lib/review/apply.ts` did.
  Conditional `fileMatch` inclusion is live, not just declared.
- ✅ **Skills are discovered and activate.** The five skills in `.kiro/skills/` appear in the
  agent's skill registry by `name` and `description`, and activating one returns its full
  `SKILL.md` body along with its directory path. `npm run check:kiro` link-checks them (the
  doc count went from 29 to 34).
- ✅ **The quality gate passes.** `npm run verify` was run from the terminal — lint, typecheck,
  `check:kiro`, then 285 tests across 27 files, all green.

### Still needs the Kiro IDE

These cannot be done from an agent session or a repository alone:

1. Open the Agent Hooks panel and confirm the five hooks are listed and enabled. **Note on
   format:** the hook files here use the IDE 0.x `.kiro.hook` schema (`when.type`
   `fileEdited` / `userTriggered`, `then.type` `askAgent`). Kiro's current schema is a
   `.kiro/hooks/<id>.json` file with `version: "v1"` and PascalCase triggers
   (`fileEdited` → `PostFileSave`), a single regex `matcher` instead of a glob array, and no
   equivalent at all for `userTriggered` — so the manual "Quality gate" hook cannot be
   migrated as a hook. The IDE offers an upgrade badge on legacy hooks; migrating also means
   updating `scripts/check-kiro.mjs`, which currently requires `.kiro/hooks/*.kiro.hook` and
   validates the 0.x shape. Decide and do both together.
2. Confirm a file-edit hook actually fires. An agent edit to `src/lib/scanner/rules.ts` (a blank
   line added, then reverted) did **not** trigger "Detection rule changed → rule corpus" in the
   agent session, which is consistent with the legacy format no longer being executed. Worth
   re-testing in the IDE before relying on any hook.
3. Run "Quality gate (run before pushing)" from the hooks panel. Its prompt body
   (`npm run verify`) was run directly and passes; the panel's play button was not used.
4. Open a spec in Kiro's spec view and work through an unchecked task (for example DET-20,
   unhandled promise rejections) to see requirements → design → tasks → code in Kiro itself.
   The spec files themselves are verified by `check:kiro`: 7 folders each with
   `requirements.md`, `design.md` and `tasks.md`, and 74 unique requirement ids.
