import { describe, expect, it, vi } from "vitest";
import { fetchPullRequest, parsePrUrl, postReview } from "../github";

describe("parsePrUrl", () => {
  it.each([
    ["https://github.com/acme/shop/pull/42", { owner: "acme", repo: "shop", number: 42 }],
    ["github.com/acme/shop/pull/42/files", { owner: "acme", repo: "shop", number: 42 }],
    ["https://www.github.com/a-b/c.d/pull/1?x=1#y", { owner: "a-b", repo: "c.d", number: 1 }],
    ["acme/shop#7", { owner: "acme", repo: "shop", number: 7 }],
  ])("parses %s", (input, ref) => {
    expect(parsePrUrl(input)).toEqual({ ok: true, ref });
  });

  it.each([
    ["", /Paste a pull request link/],
    ["https://gitlab.com/a/b/pull/1", /Only github.com/],
    ["https://github.com/a/b/issues/1", /Link to a pull request/],
    ["https://github.com/a/b/pull/0", /positive whole number/],
    ["https://github.com/a/b/pull/abc", /positive whole number/],
    ["http://", /does not look like a link/],
  ])("rejects %j", (input, msg) => {
    const r = parsePrUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
});

describe("mock GitHub API", () => {
  const ref = { owner: "kiro-labs", repo: "haunted-shop", number: 42 };

  it("returns a deterministic PR with two files and changed lines", async () => {
    const a = await fetchPullRequest(ref, { signedIn: false, latencyMs: 0 });
    const b = await fetchPullRequest(ref, { signedIn: false, latencyMs: 0 });
    expect(a).toEqual(b);
    expect(a.files).toHaveLength(2);
    expect(new Set(a.files.map((f) => f.path)).size).toBe(2);
    expect(a.files.every((f) => f.changedLines.length > 0)).toBe(true);
    expect(a.url).toBe("https://github.com/kiro-labs/haunted-shop/pull/42");
  });

  it("requires sign-in for private repos", async () => {
    await expect(fetchPullRequest({ ...ref, repo: "private-vault" }, { signedIn: false, latencyMs: 0 })).rejects.toMatchObject({ code: "auth_required" });
    await expect(fetchPullRequest({ ...ref, repo: "private-vault" }, { signedIn: true, latencyMs: 0 })).resolves.toBeTruthy();
  });

  it("reports missing PRs and rate limits", async () => {
    await expect(fetchPullRequest({ ...ref, number: 9001 }, { signedIn: true, latencyMs: 0 })).rejects.toMatchObject({ code: "not_found" });
    await expect(fetchPullRequest({ ...ref, repo: "rate-limit" }, { signedIn: true, latencyMs: 0 })).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("can be aborted", async () => {
    vi.useFakeTimers();
    const c = new AbortController();
    const p = fetchPullRequest(ref, { signedIn: false, signal: c.signal });
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    vi.useRealTimers();
  });

  it("posts reviews only when signed in", async () => {
    const input = { ref, event: "COMMENT" as const, body: "hi", comments: [] };
    await expect(postReview(input, { signedIn: false, latencyMs: 0 })).rejects.toMatchObject({ code: "auth_required" });
    await expect(postReview(input, { signedIn: true, latencyMs: 0 })).resolves.toMatch(/^https:\/\/github.com\/kiro-labs\/haunted-shop\/pull\/42#pullrequestreview-\d+$/);
  });
});
