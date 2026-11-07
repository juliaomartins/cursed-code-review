---
inclusion: fileMatch
fileMatchPattern: "src/lib/scanner/**"
---
# Writing or changing a detection rule

- Match on `code[i]` (the masked line from `lexer.ts`), never on raw text alone; build the fix from the original line, and only when the matched code is identical in both.
- Register the rule in `rules.ts` (`RULES_META`): id, title, monster, category, CWE (and OWASP when one applies), default confidence, impact, remediation, `autofix`, and only the languages the tests cover.
- Severity CRITICAL needs evidence on the line (`exposure: "untrusted-input"` from `UNTRUSTED`, or a live-format key). Never guess reachability.
- When the rule cannot confirm a risk, set confidence `low` and say why in the explanation.
- If no safe automatic fix exists, set `autofix: false` and put the remediation in `fix.note`; `fix.after` equals `fix.before`.
- Set `column` to where the problem starts (1-based).
- A rule must not throw; `scanDetailed` contains failures, but a crash hides findings.
- Add to `src/lib/__tests__/accuracy.test.ts`: at least one vulnerable example, one lookalike-safe example, and one in a comment or string. Then update the DET rows in `.kiro/specs/TRACEABILITY.md` and run `npm run test:scanner` and `npm run check:kiro`.
