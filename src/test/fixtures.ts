import type { PullRequest, ScanResult } from "@/lib/github";
import { SAMPLES } from "@/lib/samples";

/** A pull request as /api/github/pr returns it, built from the cursed samples. */
export function fixturePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  const files = SAMPLES.slice(0, 2).map((s) => {
    const lines = s.code.split("\n");
    const changedLines = lines.map((_, i) => i + 1).filter((n) => lines[n - 1].trim() !== "");
    return { path: s.path, language: s.language, code: s.code, changedLines, additions: changedLines.length, deletions: 0 };
  });
  return {
    owner: "kiro-labs",
    repo: "haunted-shop",
    number: 42,
    url: "https://github.com/kiro-labs/haunted-shop/pull/42",
    title: "Add session caching to login",
    author: "mara-lantern",
    baseRef: "main",
    headRef: "feat/session-cache",
    headSha: "c".repeat(40),
    files,
    skippedFiles: 0,
    ...overrides,
  };
}

/** A repository scan as /api/github/scan returns it: the three cursed samples. */
export function fixtureScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    target: "repo",
    owner: "acme",
    repo: "shop",
    ref: "main",
    sha: "d".repeat(40),
    title: "acme/shop: a haunted shop",
    url: "https://github.com/acme/shop",
    files: SAMPLES.map((s) => ({ path: s.path, language: s.language, code: s.code })),
    skippedFiles: 4,
    ...overrides,
  };
}
