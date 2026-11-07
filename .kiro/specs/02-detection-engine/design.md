# Design — Detection Engine

Pipeline in `src/lib/scanner/index.ts` (`scanDetailed`):
1. Split lines (CRLF normalised); blank out lines over 2,000 chars and count them.
2. `lexer.ts` `maskSource`: comments → spaces, string contents → `_`, quotes kept; block comments, template literals and Python triple quotes span lines.
3. Run rules (`injection.ts`, `security.ts`, `secrets.ts`, `nullAccess.ts`, `offByOne.ts`, `race.ts`, `memoryLeak.ts`, `errors.ts`, `deadCode.ts`) inside try/catch with `{ lines, code: masked, language }`.
4. Dedupe `ruleId:line`, PR-line filter, `ccr-ignore` (comment positions only), metadata from `rules.ts` (`RULES_META`), default column, `severityOf` (CRITICAL needs `exposure`).

Evidence: `UNTRUSTED` regexes in `rules.ts` (request data per language). Constant-only interpolation → confidence low.
Ids: older rules keep `file:kind:line`; newer rules append `:ruleId`.
