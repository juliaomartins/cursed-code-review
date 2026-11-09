---
name: new-requirement
description: Add a feature to Mateklamar Code Review the spec-first way, as an EARS requirement traced to code and tests. Use when starting a new feature or behaviour change, adding a requirement id, updating a spec's design or tasks, or fixing a traceability gap reported by check:kiro.
---

# Add a requirement, spec first

Nothing ships here without a requirement id that traces to code and to a named test.
`npm run check:kiro` enforces that link, and `.kiro/specs/TRACEABILITY.md` is the single index.

## 1. Pick the spec and the next free id

Each spec owns exactly one id prefix:

| Spec folder | Prefix |
| --- | --- |
| `.kiro/specs/01-haunted-monster-experience` | `MON` |
| `.kiro/specs/02-detection-engine` | `DET` |
| `.kiro/specs/03-safe-fix-engine` | `FIX` |
| `.kiro/specs/04-github-integration` | `GH` |
| `.kiro/specs/05-developer-review-experience` | `DRX` |
| `.kiro/specs/06-accessibility-performance` | `A11Y` |
| `.kiro/specs/07-testing-quality` | `QA` |

Take the next unused number in that spec's `requirements.md`. **Never renumber or rename an
existing id** — the matrix, the hooks and the docs all reference them. Ids must be unique
across every spec; `check:kiro` fails on a duplicate.

## 2. Write the requirement in EARS form

Add it to the spec's `requirements.md` in the existing `**PREFIX-n**` style, matching the
phrasing of its neighbours. Use the EARS pattern that fits:

- ubiquitous — "The system shall ..."
- event-driven — "When `<trigger>`, the system shall ..."
- state-driven — "While `<state>`, the system shall ..."
- unwanted behaviour — "If `<condition>`, then the system shall ..."
- optional — "Where `<feature>`, the system shall ..."

One testable behaviour per requirement. If you cannot name the test that would prove it, the
requirement is still too vague.

## 3. Update design.md and tasks.md

In the same spec folder:

- `design.md` — how the behaviour works: the modules involved, the data flow, and the
  trade-offs you chose. Keep it consistent with `.kiro/steering/structure.md`.
- `tasks.md` — the implementation steps, in the file's existing checklist style, each
  referencing the new id.

## 4. Add the traceability row

Append a row to `.kiro/specs/TRACEABILITY.md`:

```
| PREFIX-n | Short requirement summary | `src/path/one.ts`, `src/path/two.tsx` | `src/lib/__tests__/area.test.ts` › "exact test name" | ✅ |
```

Rules `check:kiro` enforces on that row:

- every backticked path in **Source** must exist on disk
- a **Verified by** reference reads `` `file` › "test name" ``, and the test name must appear
  verbatim in that file — it greps for `"test name"`, so copy the `it(...)` string exactly
- separate multiple tests with `<br>`
- status must be one of ✅ implemented and verified, 🟡 partial with the limitation stated,
  ❌ not implemented
- ✅ with no test or command listed is rejected

Be honest about status. 🟡 and ❌ rows are expected and allowed; a false ✅ is the one thing
the matrix cannot tolerate.

## 5. Verify

```
npm run check:kiro
```

Then run the test suite for the area you touched (`npm run test:scanner`,
`npm run test:fix-engine`, `npm run test:ui`) and `npm run verify` before handing over.
