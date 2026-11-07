# Requirements — GitHub Integration

## Problem
Developers' code lives on GitHub. Review results are only useful if they can be pulled from, and sent back to, the real repository, securely and with honest error messages.

## Goals
- Public code works without signing in; private code with the user's own GitHub App authorisation.
- Every GitHub action either succeeds verifiably or explains why it failed.

## Functional requirements
- **GH-1** Sign-in SHALL use the GitHub App user-authorisation flow with a `state` cookie checked on callback; a reloaded or lost callback SHALL be handled without a confusing error.
- **GH-2** Tokens SHALL stay server-side in an AES-GCM sealed, HTTP-only cookie and SHALL refresh before expiry.
- **GH-3** Public pull requests and repositories SHALL be readable without signing in.
- **GH-4** The system SHALL scan pull requests, files (with line ranges), folders, repositories, commits and comparisons from a pasted link.
- **GH-5** Folder and repository scans SHALL read at most 40 supported files, source first, skipping generated/vendored/large files, and suggest folders that fit when truncated.
- **GH-6** The system SHALL post a PR review with inline suggestions on the head commit; on the user's own PR only "Comment" SHALL be offered.
- **GH-7** The system SHALL create an issue listing findings linked to lines at the scanned commit.
- **GH-8** "Open a fix PR" SHALL commit one file per commit to a new branch and SHALL skip, never overwrite, files that changed on GitHub since the scan.
- **GH-9** "Push fixes to this PR" SHALL refuse forks, closed PRs and PRs with newer commits.
- **GH-10** WHEN access fails THEN the system SHALL explain the cause (app not installed, repository not selected, permission not accepted) with the fix.
- **GH-11** Rate limits SHALL be reported as such.
- **GH-12** Issues and review comments SHALL never contain secret values.

## Non-functional requirements
Server code in `src/server/` is unit-tested against a fake GitHub API; the browser never sees tokens.

## Edge cases
Branch names with slashes; renamed/deleted files; empty folders; missing Issues permission; own-PR approval rule; expired tokens.

## Security
State check against CSRF; sealed cookies; relative-only return paths; secrets redacted before anything is posted.

## Testing
`src/server/__tests__/*` (routes, session, scan, fixes, repos, diagnose, setup) and e2e flows with GitHub mocked in the browser.
