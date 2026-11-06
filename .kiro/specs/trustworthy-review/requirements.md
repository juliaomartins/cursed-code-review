# Requirements — Trustworthy review

Goal: a developer can submit real code, get accurate and understandable findings, review a safe fix, apply it, undo it, and verify it worked.

## 1. Detection accuracy
- **1.1** The scanner SHALL ignore text inside comments and string literals when matching code patterns (lexer masking), in JavaScript, TypeScript, Python and PHP.
- **1.2** SQL injection SHALL require a statement shape (SELECT…FROM, INSERT INTO, UPDATE…SET, DELETE FROM) built from a non-literal; plain UI text containing an SQL word SHALL NOT be reported.
- **1.3** Command injection SHALL be reported for shell commands built from variables: JS `exec`/`execSync` (only when `child_process` is imported) and `spawn`/`execFile` with `shell: true`; Python `os.system`/`os.popen` and `subprocess.*(…, shell=True)`; PHP `exec`/`system`/`shell_exec`/`passthru`/`popen`/`proc_open` with a variable.
- **1.4** Code injection SHALL be reported for `eval`/`new Function` (JS), `eval`/`exec` (Python) and `eval` (PHP) on non-literal input; `ast.literal_eval` and method calls such as `model.eval()` SHALL NOT be reported.
- **1.5** Disabled TLS verification (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED='0'`, `verify=False` on HTTP calls) and unverified JWTs (`jwt.decode(…, verify=False)`, `algorithms: ['none']`) SHALL be reported.
- **1.6** Swallowed errors SHALL be reported for empty `catch` blocks and for bare / catch-all `except … : pass`; catching a specific exception and passing SHALL NOT be reported.
- **1.7** Hardcoded secrets SHALL be reported for known credential formats, or for a credential-named variable (not a descriptive name such as `tokenType` or `passwordLabel`) holding a credential-shaped value (no spaces, ≥ 8 characters, not plain words).
- **1.8** The scanner SHALL report at most one finding per rule per line.
- **1.9** WHEN a comment contains `ccr-ignore` (or `ccr-ignore: <rule-id>, …`) on the finding's line or on a comment-only line above THEN the finding SHALL be suppressed and counted.
- **1.10** The scanner SHALL NOT throw on malformed input, SHALL skip lines longer than 2,000 characters and report how many it skipped.

## 2. Understandable findings
- **2.1** Every finding SHALL carry a rule id, category, severity (Critical, High, Medium, Low), confidence, 1-based line and column, explanation, impact, remediation and CWE reference (OWASP where applicable).
- **2.2** Severity SHALL be Critical only with evidence on the line: untrusted input reaching an injection sink, or a live-format credential.
- **2.3** WHEN the scanner cannot confirm a risk (e.g. only constant-looking values are interpolated) THEN the finding SHALL have low confidence and say so.

## 3. Safe fixes
- **3.1** A fix SHALL be applied only when its target lines sit exactly at the finding's start line; otherwise it SHALL be rejected and the finding marked stale.
- **3.2** A fix SHALL change only its own lines; all other lines SHALL be byte-identical.
- **3.3** WHEN identical code appears more than once THEN re-location SHALL NOT move a finding onto an occurrence claimed by another finding.
- **3.4** The banishment animation SHALL start only after a dry run confirms the fix applies; IF it does not THEN the UI SHALL say the monster resists and SHALL NOT report success.
- **3.5** WHEN a fix is applied THEN the system SHALL re-scan the fixed code and record whether the same rule still fires on the changed lines.
- **3.6** Rules without a safe automatic fix SHALL NOT change code; they SHALL show remediation guidance.
- **3.7** Undo SHALL restore the exact previous content.

## 4. Workflow
- **4.1** The developer SHALL be able to dismiss a finding with a reason (false positive, accepted risk, fixed outside the app) and restore it.
- **4.2** The developer SHALL be able to re-scan a file and see how many findings were resolved, added and remain; dismissals SHALL survive the re-scan for the same finding only.
- **4.3** The report SHALL offer filtering by severity, category and status, text search, and sorting by priority, and SHALL link each finding to its code.
- **4.4** The report SHALL show the five highest-priority open findings (severity × confidence, plus exposure).

## 5. Reports
- **5.1** The Markdown report SHALL include source, files analysed, scan and generation timestamps, a severity × status table, categories, a "Fix first" list, and per finding: status (with verification or dismissal reason), rule, references, explanation, impact, remediation and the suggested change.
- **5.2** Secret values SHALL be redacted in reports, GitHub issues and review comments.
