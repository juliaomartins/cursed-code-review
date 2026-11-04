// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parsePatch, rangeIsCommentable } from "@/lib/patch";
import { SAMPLES } from "@/lib/samples";
import type { GitHubAppConfig } from "../config";
import { safeReturnTo } from "../config";
import { ApiError, createReview, ensureFresh, getPullRequest, placeComments } from "../github";
import { seal, unseal } from "../session";

const config: GitHubAppConfig = { clientId: "Iv1.abc", clientSecret: "shh", slug: "cursed-code-review", sessionSecret: "x".repeat(40) };

const PATCH = ["@@ -1,3 +1,4 @@", " a", "-b", "+B", "+C", " d", "@@ -20,2 +21,2 @@", " x", "+y", "\\ No newline at end of file"].join("\n");

describe("parsePatch", () => {
  it("collects added lines and commentable lines per hunk", () => {
    const p = parsePatch(PATCH);
    expect(p.added).toEqual([2, 3, 22]);
    expect([...p.commentable.entries()]).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [21, 1],
      [22, 1],
    ]);
    expect(rangeIsCommentable(p, 1, 4)).toBe(true);
    expect(rangeIsCommentable(p, 4, 21)).toBe(false);
    expect(parsePatch(undefined).added).toEqual([]);
  });
});

describe("session sealing", () => {
  it("round-trips and rejects tampering or the wrong secret", () => {
    const token = seal({ a: 1 }, config.sessionSecret);
    expect(unseal(token, config.sessionSecret)).toEqual({ a: 1 });
    expect(unseal(token, "y".repeat(40))).toBeNull();
    expect(unseal(token.slice(0, -2) + "AA", config.sessionSecret)).toBeNull();
    expect(unseal("garbage", config.sessionSecret)).toBeNull();
    expect(unseal(undefined, config.sessionSecret)).toBeNull();
  });

  it("only allows relative return paths", () => {
    expect(safeReturnTo("/report")).toBe("/report");
    expect(safeReturnTo("//evil.com")).toBe("/");
    expect(safeReturnTo("https://evil.com")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });
});

/** A tiny fake of the GitHub REST API keyed by "METHOD path". */
function fakeGitHub(routes: Record<string, (init?: RequestInit) => { status?: number; json?: unknown; text?: string; headers?: Record<string, string> }>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${url.hostname === "api.github.com" ? url.pathname + url.search : url.pathname}`;
    calls.push({ key, init });
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    const r = route(init);
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: r.headers });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const login = SAMPLES[0];
const pull = {
  title: "Add login",
  html_url: "https://github.com/o/r/pull/5",
  user: { login: "octo" },
  base: { ref: "main" },
  head: { ref: "feat", sha: "a".repeat(40), repo: { full_name: "fork/r" } },
};
const loginPatch = ["@@ -0,0 +1,16 @@", ...login.code.split("\n").slice(0, 16).map((l) => `+${l}`)].join("\n");

const asUser = { token: "tok", asUser: true, signInAvailable: true };
const anonymous = { asUser: false, signInAvailable: false };

describe("getPullRequest", () => {
  it("loads the PR, its supported files at the head commit, and the added lines", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/pulls/5": () => ({ json: pull }),
      "GET /repos/o/r/pulls/5/files?per_page=100&page=1": () => ({
        json: [
          { filename: "src/auth/cursed-login.js", status: "added", additions: 16, deletions: 0, patch: loginPatch },
          { filename: "README.md", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1 @@\n-a\n+b" },
          { filename: "old.js", status: "removed", additions: 0, deletions: 3, patch: "@@ -1,3 +0,0 @@\n-a" },
        ],
      }),
      [`GET /repos/fork/r/contents/src/auth/cursed-login.js?ref=${"a".repeat(40)}`]: () => ({ text: login.code }),
    });
    const pr = await getPullRequest({ owner: "o", repo: "r", number: 5 }, asUser, { fetch: gh.fetch });
    expect(pr).toMatchObject({ title: "Add login", author: "octo", headSha: "a".repeat(40), baseRef: "main", headRef: "feat", skippedFiles: 2 });
    expect(pr.files).toHaveLength(1);
    expect(pr.files[0]).toMatchObject({ path: "src/auth/cursed-login.js", language: "javascript" });
    expect(pr.files[0].changedLines).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(gh.calls[0].init?.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("explains missing access as 'not installed' with an install link", async () => {
    const gh = fakeGitHub({});
    await expect(getPullRequest({ owner: "o", repo: "r", number: 5 }, asUser, { fetch: gh.fetch })).rejects.toMatchObject({
      code: "not_installed",
      installUrl: "/api/auth/github/login?install=1",
    });
  });

  it("rejects PRs with no readable files", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/pulls/5": () => ({ json: pull }),
      "GET /repos/o/r/pulls/5/files?per_page=100&page=1": () => ({ json: [{ filename: "a.go", status: "added", additions: 1, deletions: 0, patch: "@@ -0,0 +1 @@\n+x" }] }),
    });
    await expect(getPullRequest({ owner: "o", repo: "r", number: 5 }, asUser, { fetch: gh.fetch })).rejects.toMatchObject({ code: "unsupported" });
  });

  it("opens public PRs without a token, downloading files from raw.githubusercontent.com", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/pulls/5": () => ({ json: pull }),
      "GET /repos/o/r/pulls/5/files?per_page=100&page=1": () => ({
        json: [{ filename: "src/auth/cursed-login.js", status: "added", additions: 16, deletions: 0, patch: loginPatch }],
      }),
      [`GET /fork/r/${"a".repeat(40)}/src/auth/cursed-login.js`]: () => ({ text: login.code }),
    });
    const pr = await getPullRequest({ owner: "o", repo: "r", number: 5 }, anonymous, { fetch: gh.fetch });
    expect(pr.files[0].code).toBe(login.code);
    expect(gh.calls.every((c) => !(c.init?.headers as Record<string, string> | undefined)?.Authorization)).toBe(true);
    expect(gh.calls.map((c) => c.key)).toContain(`GET /fork/r/${"a".repeat(40)}/src/auth/cursed-login.js`);
  });

  it("explains missing public PRs, and suggests sign-in when it's available", async () => {
    const gh = fakeGitHub({});
    await expect(getPullRequest({ owner: "o", repo: "r", number: 5 }, anonymous, { fetch: gh.fetch })).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("Only public repositories"),
    });
    await expect(getPullRequest({ owner: "o", repo: "r", number: 5 }, { ...anonymous, signInAvailable: true }, { fetch: gh.fetch })).rejects.toMatchObject({
      code: "auth_required",
      status: 401,
    });
  });

  it("maps rate limits", async () => {
    const gh = fakeGitHub({ "GET /repos/o/r/pulls/5": () => ({ status: 403, json: { message: "rate" }, headers: { "x-ratelimit-remaining": "0" } }) });
    await expect(getPullRequest({ owner: "o", repo: "r", number: 5 }, asUser, { fetch: gh.fetch })).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("review placement and posting", () => {
  const patches = new Map([["f.js", parsePatch(PATCH)]]);

  it("keeps commentable comments inline, multi-line only inside one hunk, and folds the rest", () => {
    const { inline, folded } = placeComments(
      [
        { path: "f.js", line: 3, startLine: 2, body: "```suggestion\nX\nY\n```" },
        { path: "f.js", line: 22, body: "single" },
        { path: "f.js", line: 21, startLine: 4, body: "```suggestion\nZ\n```" },
        { path: "f.js", line: 10, body: "outside" },
        { path: "other.js", line: 1, body: "unknown file" },
      ],
      patches,
    );
    expect(inline).toEqual([
      { path: "f.js", line: 3, start_line: 2, side: "RIGHT", start_side: "RIGHT", body: "```suggestion\nX\nY\n```" },
      { path: "f.js", line: 22, side: "RIGHT", body: "single" },
      { path: "f.js", line: 21, side: "RIGHT", body: "```diff\nZ\n```" },
    ]);
    expect(folded.map((c) => c.body)).toEqual(["outside", "unknown file"]);
  });

  it("posts a review against the head commit", async () => {
    let posted: Record<string, unknown> = {};
    const gh = fakeGitHub({
      "GET /repos/o/r/pulls/5/files?per_page=100&page=1": () => ({ json: [{ filename: "f.js", status: "modified", additions: 3, deletions: 1, patch: PATCH }] }),
      "POST /repos/o/r/pulls/5/reviews": (init) => {
        posted = JSON.parse(String(init?.body));
        return { json: { html_url: "https://github.com/o/r/pull/5#pullrequestreview-1" } };
      },
    });
    const res = await createReview(
      "tok",
      {
        ref: { owner: "o", repo: "r", number: 5 },
        commitId: "b".repeat(40),
        event: "REQUEST_CHANGES",
        body: "Monsters!",
        comments: [
          { path: "f.js", line: 2, body: "inline" },
          { path: "f.js", line: 9, body: "**Imp** folded" },
        ],
      },
      { fetch: gh.fetch },
    );
    expect(res).toEqual({ url: "https://github.com/o/r/pull/5#pullrequestreview-1", inline: 1, folded: 1 });
    expect(posted).toMatchObject({ commit_id: "b".repeat(40), event: "REQUEST_CHANGES", comments: [{ path: "f.js", line: 2, side: "RIGHT", body: "inline" }] });
    expect(posted.body).toContain("`f.js:9` **Imp** folded");
  });
});

describe("token refresh", () => {
  const session = { user: { login: "u", name: "U", avatarUrl: "" }, accessToken: "old", refreshToken: "r1", expiresAt: 1_000_000 };

  it("keeps fresh tokens", async () => {
    expect(await ensureFresh(config, session, { now: () => 0 })).toEqual({ session, refreshed: false });
  });

  it("refreshes tokens that are about to expire", async () => {
    const gh = fakeGitHub({ "POST /login/oauth/access_token": () => ({ json: { access_token: "new", refresh_token: "r2", expires_in: 28800 } }) });
    const res = await ensureFresh(config, session, { now: () => 990_000, fetch: gh.fetch });
    expect(res.refreshed).toBe(true);
    expect(res.session).toMatchObject({ accessToken: "new", refreshToken: "r2", expiresAt: 990_000 + 28_800_000 });
    expect(JSON.parse(String(gh.calls[0].init?.body))).toMatchObject({ grant_type: "refresh_token", refresh_token: "r1", client_id: "Iv1.abc" });
  });

  it("asks to sign in again without a refresh token", async () => {
    await expect(ensureFresh(config, { ...session, refreshToken: undefined }, { now: () => 2_000_000 })).rejects.toBeInstanceOf(ApiError);
  });
});
