# Design — GitHub Integration

- Routes `src/app/api/auth/*` and `src/app/api/github/*` are thin; logic in `src/server/`: `config.ts`, `session.ts` (seal/unseal, refresh), `github.ts` (API client, PR loading, review placement), `scan.ts` (link scans, folder suggestions, issues), `fixes.ts` (commits, branches), `repos.ts`, `diagnose.ts`, `setup` manifest flow.
- Browser client `src/lib/githubLive.ts`; link parsing `src/lib/githubLinks.ts`; report/issue/comment bodies `src/lib/report.ts` (redacted).
