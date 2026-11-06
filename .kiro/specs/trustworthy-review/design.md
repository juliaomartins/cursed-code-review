# Design — Trustworthy review

## Scanner pipeline
`scanDetailed(code, language)`:
1. Split lines (CRLF normalised); blank lines over 2,000 chars (counted as skipped).
2. `maskSource` (lexer.ts): per line, comment text → spaces, string contents → `_`, quotes kept. Block comments, template literals and Python triple quotes carry across lines; other strings end at the line end. Never throws.
3. Run every rule with `{ lines, code: masked, language }` inside try/catch.
4. For each raw finding: dedupe on `ruleId:line`, filter to PR lines, apply `ccr-ignore` suppression (comment positions only), fill metadata from `RULES_META`, default column = first non-space, severity via `severityOf` (CRITICAL needs `exposure`).
5. Sort by line then column.

Ids: rules that existed before rule ids keep `file:kind:line`; newer rules add `:ruleId` so two rules sharing a monster on one line don't collide.

## Evidence
`UNTRUSTED` regexes per language match request data visible on the line (`req.body`, `request.args`, `$_GET`, `sys.argv`…). Only these set `exposure: "untrusted-input"`. Interpolations that are all constant-looking (`TABLE`, `10`) get confidence `low` with an explanation.

## Fix engine
- `applyFix` → `targetsCurrentCode` must hold at `fix.startLine` (trimmed compare), then splice and re-indent.
- `relocate` → findings already in place claim their occurrence first; the rest move to the nearest unclaimed occurrence or become stale.
- `verifyFix` → re-scan the fixed code; `still-detected` if the same rule fires within the written lines.
- `rescanFile` → fresh scan merged with history: banished kept, each fresh finding paired with at most one known finding of the same rule and code (nearest line), statuses and dismissal reasons carried over.

## Prioritisation
`priority = severityWeight × confidenceWeight (+15 with exposure)`; weights Critical 100 / High 70 / Medium 40 / Low 15 and high 1 / medium 0.75 / low 0.4.

## Presentation
Detail panel: rule facts row, exposure badge, Impact / How to fix, diff or manual-fix note, Ignore menu with reasons, graveyard shows verification. Report page: Fix first, filterable `FindingsTable`. Markdown report rebuilt around severity × status and per-finding sections; `redactSecrets` uses the secrets rule's own detection.
