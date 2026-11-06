# Tasks — Trustworthy review

- [x] Lexer masking comments/strings for JS/TS, Python, PHP (`lexer.ts`) + tests
- [x] Rule registry with category, CWE/OWASP, confidence, impact, remediation, autofix (`rules.ts`)
- [x] Make every existing rule match on masked code; SQL needs a statement shape
- [x] Secrets: name words + descriptive suffixes, credential-shaped values, known formats, CRITICAL for live keys
- [x] New rules: command injection, code injection, TLS verification disabled, JWT unverified, swallowed errors
- [x] Evidence-based CRITICAL; low confidence for constant-only interpolation
- [x] `ccr-ignore` suppression, per-rule; dedupe per rule per line; skip overlong lines; rule errors contained
- [x] Strict `applyFix`; duplicate-aware `relocate`; manual findings never applied
- [x] Post-fix verification; re-scan file with one-to-one pairing
- [x] Dismiss with reason; restore
- [x] Priority model; Fix first; filterable/searchable findings table linking to code
- [x] Markdown report rebuilt; secrets redacted in report, issue and review comments
- [x] Corpus tests (vulnerable + lookalike safe), columns, malformed/huge input, suppression, duplicates
- [x] Property tests: unrelated lines unchanged, undo exact, stale rejected, resolved not re-reported, rescan keeps dismissals
- [x] CI workflow (lint, typecheck, unit, build, e2e)
- [ ] Unhandled promise rejections (needs statement-level parsing; not implemented)
- [ ] Cross-file / data-flow analysis (out of scope for a per-file rule engine)
- [ ] Persist suppressions back to GitHub (suppressions live in code comments today)
