// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { pushFixes, sha256, type FixFile } from "../fixes";

type Route = (init?: RequestInit) => { status?: number; json?: unknown };
function fakeGitHub(routes: Record<string, Route>) {
  const calls: { key: string; body?: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${decodeURIComponent(url.pathname + url.search)}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key]?.(init);
    if (!r) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const SHA = "a".repeat(40);
const b64 = (s: string) => Buffer.from(s).toString("base64");
const original = "const a = 1;\nfor (let i = 0; i <= xs.length; i++) {}\n";
const fixed = "const a = 1;\nfor (let i = 0; i < xs.length; i++) {}\n";
const file = (path: string, orig = original): FixFile => ({ path, content: fixed, originalHash: sha256(orig), message: `Banish 1 monster in ${path}` });
const newBranch = { kind: "newBranch" as const, baseSha: SHA, baseBranch: "main", branch: "cursed-fixes/today", title: "🔥 Banish 2 monsters", body: "body" };

describe("open a fix PR", () => {
  it("creates a branch, commits each file separately, then opens the PR", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/branches/main": () => ({ json: { name: "main" } }),
      "POST /repos/o/r/git/refs": () => ({ status: 201, json: {} }),
      "GET /repos/o/r/contents/src/a.js?ref=cursed-fixes/today": () => ({ json: { sha: "blobA", content: b64(original), encoding: "base64" } }),
      "GET /repos/o/r/contents/src/b.js?ref=cursed-fixes/today": () => ({ json: { sha: "blobB", content: b64(original.replace(/\n/g, "\r\n")), encoding: "base64" } }),
      "PUT /repos/o/r/contents/src/a.js": () => ({ status: 200, json: {} }),
      "PUT /repos/o/r/contents/src/b.js": () => ({ status: 200, json: {} }),
      "POST /repos/o/r/pulls": () => ({ status: 201, json: { html_url: "https://github.com/o/r/pull/9" } }),
    });
    const res = await pushFixes("tok", { owner: "o", repo: "r", files: [file("src/a.js"), file("src/b.js")], target: newBranch }, { fetch: gh.fetch });
    expect(res).toEqual({ url: "https://github.com/o/r/pull/9", branch: "cursed-fixes/today", commits: 2, skipped: [] });
    expect(gh.calls.find((c) => c.key === "POST /repos/o/r/git/refs")!.body).toEqual({ ref: "refs/heads/cursed-fixes/today", sha: SHA });
    const puts = gh.calls.filter((c) => c.key.startsWith("PUT"));
    expect(puts.map((p) => p.body!.message)).toEqual(["Banish 1 monster in src/a.js", "Banish 1 monster in src/b.js"]);
    expect(puts[0].body).toMatchObject({ sha: "blobA", branch: "cursed-fixes/today" });
    expect(Buffer.from(String(puts[0].body!.content), "base64").toString()).toBe(fixed);
    // Windows line endings are kept.
    expect(Buffer.from(String(puts[1].body!.content), "base64").toString()).toBe(fixed.replace(/\n/g, "\r\n"));
    expect(gh.calls.at(-1)!.body).toMatchObject({ head: "cursed-fixes/today", base: "main", title: "🔥 Banish 2 monsters" });
  });

  it("picks a new branch name if the first is taken, and never overwrites files that changed", async () => {
    let refTries = 0;
    const gh = fakeGitHub({
      "GET /repos/o/r/branches/main": () => ({ json: {} }),
      "POST /repos/o/r/git/refs": () => (++refTries === 1 ? { status: 422, json: { message: "Reference already exists" } } : { status: 201, json: {} }),
      "GET /repos/o/r/contents/a.js?ref=cursed-fixes/today-2": () => ({ json: { sha: "x", content: b64(original), encoding: "base64" } }),
      "GET /repos/o/r/contents/b.js?ref=cursed-fixes/today-2": () => ({ json: { sha: "y", content: b64("someone changed this"), encoding: "base64" } }),
      "PUT /repos/o/r/contents/a.js": () => ({ json: {} }),
      "POST /repos/o/r/pulls": () => ({ status: 201, json: { html_url: "https://github.com/o/r/pull/10" } }),
    });
    const res = await pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js"), file("b.js")], target: newBranch }, { fetch: gh.fetch });
    expect(res.branch).toBe("cursed-fixes/today-2");
    expect(res.commits).toBe(1);
    expect(res.skipped).toEqual([{ path: "b.js", reason: "It changed on GitHub since the scan." }]);
    expect(gh.calls.some((c) => c.key === "PUT /repos/o/r/contents/b.js")).toBe(false);
  });

  it("deletes the empty branch when nothing could be committed", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/branches/main": () => ({ json: {} }),
      "POST /repos/o/r/git/refs": () => ({ status: 201, json: {} }),
      "GET /repos/o/r/contents/a.js?ref=cursed-fixes/today": () => ({ json: { sha: "x", content: b64("changed"), encoding: "base64" } }),
      "DELETE /repos/o/r/git/refs/heads/cursed-fixes/today": () => ({ status: 204, json: {} }),
    });
    await expect(pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js")], target: newBranch }, { fetch: gh.fetch })).rejects.toMatchObject({ code: "nothing_committed" });
    expect(gh.calls.some((c) => c.key.startsWith("DELETE"))).toBe(true);
    expect(gh.calls.some((c) => c.key === "POST /repos/o/r/pulls")).toBe(false);
  });

  it("explains a missing Contents permission and a base that isn't a branch", async () => {
    const noPerm = fakeGitHub({
      "GET /repos/o/r/branches/main": () => ({ json: {} }),
      "POST /repos/o/r/git/refs": () => ({ status: 403, json: { message: "Resource not accessible by integration" } }),
    });
    await expect(pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js")], target: newBranch }, { fetch: noPerm.fetch })).rejects.toMatchObject({
      code: "missing_permission",
      message: expect.stringContaining("Contents → Read and write"),
    });
    await expect(pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js")], target: newBranch }, { fetch: fakeGitHub({}).fetch })).rejects.toMatchObject({ code: "not_a_branch" });
  });
});

describe("push fixes to an open PR", () => {
  const pr = (over: Record<string, unknown> = {}) => ({
    html_url: "https://github.com/o/r/pull/5",
    state: "open",
    head: { ref: "test/cursed-bugs", sha: SHA, repo: { full_name: "o/r" } },
    ...over,
  });
  const target = { kind: "prBranch" as const, number: 5, headSha: SHA };

  it("commits onto the PR's own branch", async () => {
    const gh = fakeGitHub({
      "GET /repos/o/r/pulls/5": () => ({ json: pr() }),
      "GET /repos/o/r/contents/a.js?ref=test/cursed-bugs": () => ({ json: { sha: "x", content: b64(original), encoding: "base64" } }),
      "PUT /repos/o/r/contents/a.js": () => ({ json: {} }),
    });
    const res = await pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js")], target }, { fetch: gh.fetch });
    expect(res).toEqual({ url: "https://github.com/o/r/pull/5", branch: "test/cursed-bugs", commits: 1, skipped: [] });
    expect(gh.calls.find((c) => c.key.startsWith("PUT"))!.body).toMatchObject({ branch: "test/cursed-bugs" });
  });

  it("refuses forks, closed PRs and PRs with newer commits", async () => {
    const run = (p: unknown) => pushFixes("tok", { owner: "o", repo: "r", files: [file("a.js")], target }, { fetch: fakeGitHub({ "GET /repos/o/r/pulls/5": () => ({ json: p }) }).fetch });
    await expect(run(pr({ head: { ref: "x", sha: SHA, repo: { full_name: "someone/r" } } }))).rejects.toMatchObject({ code: "fork_pr" });
    await expect(run(pr({ state: "closed" }))).rejects.toMatchObject({ code: "pr_closed" });
    await expect(run(pr({ head: { ref: "x", sha: "b".repeat(40), repo: { full_name: "o/r" } } }))).rejects.toMatchObject({ code: "stale_commit" });
  });
});
