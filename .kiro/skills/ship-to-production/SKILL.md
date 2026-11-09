---
name: ship-to-production
description: Release a change to Mateklamar Code Review through the full quality gate and a pull request into main. Use when preparing to ship, opening a PR, cutting a release, or when asked to run the quality gate before pushing.
---

# Ship a change

`main` is the Vercel **production** branch. Everything reaches it through a pull request.

## 1. Run the full quality gate

In order, and all three must pass:

```
npm run verify
npm run build
npm run test:e2e
```

- `verify` = `lint` (including the full `jsx-a11y` set) + `typecheck` + `check:kiro` + the unit,
  component and server tests.
- `build` catches what the tests cannot: server/client boundary violations and Next.js build
  errors.
- `test:e2e` runs Playwright across desktop and Pixel 7. Needs Chromium:
  `npx playwright install chromium`.

This mirrors `.github/workflows/ci.yml`, which runs the same sequence on `ubuntu-latest` for
every pull request. Running it locally first means CI confirms rather than discovers.

If something fails, fix it at the source and summarise the failures by spec area using the
requirement ids in `.kiro/specs/TRACEABILITY.md`. **Never weaken or delete a test to make the
gate pass**, and never mark a traceability row ✅ without a test that verifies it.

## 2. Work on a feature branch

```
git switch -c <short-descriptive-branch>
```

Never commit directly to `main`, and **never force-push** — not to `main`, not to a shared
feature branch. Do not use `--no-verify` to skip hooks. If a pre-commit hook fails, fix the
problem, re-stage and make a **new** commit; do not `--amend` after a hook failure.

Stage files by name rather than `git add -A`, so unrelated working-tree changes cannot ride
along in your commit.

## 3. Secrets hygiene

- Fake credentials in tests come **only** from `src/test/fakeSecrets.ts`, which assembles them
  from fragments so real secret scanners stay quiet. Never paste a realistic-looking literal
  key into a test or a sample.
- Reports, issues and PR comments all pass through `redactSecrets`; never log or export a
  token.
- GitHub tokens stay server-side: sealed with AES-GCM in an HTTP-only cookie, never in the
  browser. Check that nothing you added leaks one into client code or into an API response.
- No new runtime dependency without a reason written in the PR description.

## 4. Open the pull request

```
gh pr create --base main --head <branch>
```

The description should state what changed, which requirement ids it touches, the verification
you ran with its result, and the reason for any new dependency. Call out anything you could not
verify rather than leaving it implied.

Let CI finish. Merge only on green.
