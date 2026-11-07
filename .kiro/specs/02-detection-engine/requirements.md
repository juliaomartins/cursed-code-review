# Requirements — Code Analysis and Detection Engine

## Problem
A review tool is only useful if developers trust its findings. Keyword matching produces noise (an SQL word in a UI string, `return` inside a template) and erodes that trust.

## Goals
- Few, accurate findings, each with enough context to act on.
- Honest confidence: say when the scanner cannot confirm a risk.

## Functional requirements
- **DET-1** The scanner SHALL ignore text inside comments and string literals when matching code (lexer masking with unchanged columns) for JavaScript, TypeScript, Python and PHP.
- **DET-2** WHEN an SQL statement shape (SELECT…FROM, INSERT INTO, UPDATE…SET, DELETE FROM) is built by interpolation or concatenation THEN the scanner SHALL report SQL injection with a parameterised fix; text that merely contains an SQL word SHALL NOT be reported.
- **DET-3** WHEN data is assigned to `innerHTML`/`outerHTML`, or PHP echoes request data, THEN the scanner SHALL report XSS, leaving already-escaped values and static strings alone.
- **DET-4** WHEN a shell command is built from a variable (JS `exec`/`execSync` with `child_process` imported, `shell: true`; Python `os.system`, `os.popen`, `subprocess.*(…, shell=True)`; PHP `system`/`exec`/`shell_exec`/`passthru`/`popen`/`proc_open`) THEN the scanner SHALL report command injection without an automatic fix.
- **DET-5** WHEN `eval`/`new Function` (JS), `eval`/`exec` (Python) or `eval` (PHP) runs a non-literal THEN the scanner SHALL report code injection; `ast.literal_eval` and method calls like `model.eval()` SHALL NOT be reported.
- **DET-6** The scanner SHALL report hardcoded secrets for known key formats, or for a credential-named variable (not a descriptive name such as `tokenType`) holding a credential-shaped value.
- **DET-7** The scanner SHALL report disabled TLS verification and unverified JWTs (`verify=False`, `algorithms: ['none']`).
- **DET-8** The scanner SHALL report property access on a value from `.find()`, DOM lookups, `.get()` or regex matches without a guard.
- **DET-9** The scanner SHALL report off-by-one loops (`<= length`), `[length]` indexes and `range(len(x) + 1)` in code only.
- **DET-10** The scanner SHALL report read–`await`–write sequences on the same value as race conditions.
- **DET-11** The scanner SHALL report module-level collections that only grow as memory leaks.
- **DET-12** The scanner SHALL report empty `catch` blocks and bare or catch-all `except: pass`; specific `except X: pass` SHALL NOT be reported.
- **DET-13** The scanner SHALL report code after `return`/`throw`/`break`/`continue` as dead code; comment-only lines SHALL NOT count.
- **DET-14** Severity SHALL be CRITICAL only with evidence on the line (untrusted input reaching an injection sink, or a live-format key); IF only constant-looking values are interpolated THEN confidence SHALL be low and the explanation SHALL say so.
- **DET-15** Every finding SHALL carry rule id, category, severity, confidence, 1-based line and column, explanation, impact, remediation and a CWE reference.
- **DET-16** The scanner SHALL report at most one finding per rule per line.
- **DET-17** WHEN a comment contains `ccr-ignore` or `ccr-ignore: <rule-ids>` on the finding's line or on a comment-only line above THEN the finding SHALL be suppressed and counted; strings SHALL NOT suppress.
- **DET-18** The scanner SHALL NOT throw on malformed input, SHALL skip lines over 2,000 characters and report how many, and SHALL scan 1,500 lines in under 3 seconds.
- **DET-19** WHEN scanning a pull request THEN only findings touching changed lines SHALL be kept.
- **DET-20** The scanner SHOULD detect unhandled promise rejections. *(Not implemented.)*
- **DET-21** The scanner SHOULD follow data across files. *(Not implemented: per-file engine by design.)*

## Non-functional requirements
- Pure TypeScript, no runtime dependencies; runs in the browser and on the server.
- A language is listed for a rule only when the corpus tests cover it.

## Edge cases
Identical vulnerable lines; Windows line endings; unterminated strings/comments; minified files; constant table names in SQL.

## Security
Findings never print full secret values (masked to 4 characters); see GH-12 / DRX-8 for exports.

## Testing
`src/lib/__tests__/accuracy.test.ts` holds vulnerable and lookalike-safe code for each rule; `scanner.test.ts` covers fixes per language.
