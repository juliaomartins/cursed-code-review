// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { toIssue } from "@/lib/report";
import { reviewFromScan } from "@/lib/review/factory";
import { reviewReducer, initialState } from "@/lib/review/reducer";
import { SAMPLES } from "@/lib/samples";
import { fixtureScan } from "@/test/fixtures";
import { createIssue } from "../github";
import { REPO_SCAN_LIMIT, scanLink, scannable, scanPriority, suggestFolders } from "../scan";

const SHA = "a".repeat(40);
const login = SAMPLES[0].code;

/** Fake GitHub keyed by "METHOD path?query" for the API and "GET /raw/path" for raw files. */
function fakeGitHub(routes: Record<string, (init?: RequestInit) => { status?: number; json?: unknown; text?: string }>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = url.hostname === "raw.githubusercontent.com" ? `RAW ${decodeURIComponent(url.pathname)}` : `${init?.method ?? "GET"} ${decodeURIComponent(url.pathname)}${url.search}`;
    calls.push({ key, init });
    const r = routes[key]?.(init);
    if (!r) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const anon = { asUser: false, signInAvailable: false };

describe("which files get scanned", () => {
  it("skips generated, vendored and unsupported files", () => {
    expect(scannable("src/app.js")).toBe(true);
    expect(scannable("node_modules/x/index.js")).toBe(false);
    expect(scannable("dist/app.min.js")).toBe(false);
    expect(scannable("types/index.d.ts")).toBe(false);
    expect(scannable("README.md")).toBe(false);
    expect(scannable("app/main.py")).toBe(true);
  });

  it("puts source before tests and config", () => {
    const order = ["vite.config.ts", "e2e/a.spec.ts", "scripts/x.js", "src/a.js"].sort((a, b) => scanPriority(a) - scanPriority(b));
    expect(order).toEqual(["src/a.js", "scripts/x.js", "e2e/a.spec.ts", "vite.config.ts"]);
  });
});

describe("folder suggestions", () => {
  it("splits folders that are still too big into subfolders that fit", () => {
    const paths = [
      ...Array.from({ length: 30 }, (_, i) => `src/components/c${i}.tsx`),
      ...Array.from({ length: 25 }, (_, i) => `src/lib/l${i}.ts`),
      ...Array.from({ length: 5 }, (_, i) => `src/x${i}.ts`),
      "e2e/a.spec.ts",
      "index.js",
    ];
    expect(suggestFolders(paths, "", 40)).toEqual([
      { path: "src/components", count: 30 },
      { path: "src/lib", count: 25 },
      { path: "src", count: 5 },
      { path: "e2e", count: 1 },
      { path: "(root)", count: 1 },
    ]);
  });
});

describe("scanLink", () => {
  it("scans a whole repository at its default branch, source first, within the limit", async () => {
    const tree = [
      { path: "README.md", type: "blob", size: 10 },
      { path: "vite.config.js", type: "blob", size: 10 },
      { path: "node_modules/x.js", type: "blob", size: 10 },
      ...Array.from({ length: REPO_SCAN_LIMIT + 5 }, (_, i) => ({ path: `src/m${String(i).padStart(2, "0")}.js`, type: "blob", size: 100 })),
    ];
    const routes: Record<string, () => { json?: unknown; text?: string }> = {
      "GET /repos/acme/shop": () => ({ json: { default_branch: "trunk", description: "A shop" } }),
      "GET /repos/acme/shop/commits/trunk": () => ({ json: { sha: SHA } }),
      [`GET /repos/acme/shop/git/trees/${SHA}?recursive=1`]: () => ({ json: { tree, truncated: false } }),
    };
    for (const t of tree) routes[`RAW /acme/shop/${SHA}/${t.path}`] = () => ({ text: login });
    const gh = fakeGitHub(routes);
    const r = await scanLink({ kind: "repo", owner: "acme", repo: "shop" }, anon, { fetch: gh.fetch });
    expect(r).toMatchObject({ target: "repo", ref: "trunk", sha: SHA, title: "acme/shop: A shop", url: "https://github.com/acme/shop" });
    expect(r.files).toHaveLength(REPO_SCAN_LIMIT);
    expect(r.files[0].path).toBe("src/m00.js");
    expect(r.files.some((f) => f.path === "vite.config.js")).toBe(false);
    expect(r.truncated).toMatchObject({ total: REPO_SCAN_LIMIT + 6, scanned: REPO_SCAN_LIMIT, folders: [{ path: "src", count: REPO_SCAN_LIMIT + 5 }, { path: "(root)", count: 1 }].map((f) => expect.objectContaining({ path: f.path })) });
    expect(r.skippedFiles).toBe(tree.length - REPO_SCAN_LIMIT);
    expect(gh.calls.filter((c) => !c.key.startsWith("RAW"))).toHaveLength(3);
  });

  it("scans a folder on a branch whose name contains a slash", async () => {
    const gh = fakeGitHub({
      "GET /repos/acme/shop/commits/feature": () => ({ json: { message: "No commit found" }, status: 422 }),
      "GET /repos/acme/shop/commits/feature/login": () => ({ json: { sha: SHA } }),
      [`GET /repos/acme/shop/git/trees/${SHA}?recursive=1`]: () => ({
        json: { tree: [{ path: "src/auth/login.js", type: "blob", size: 5 }, { path: "src/other.js", type: "blob", size: 5 }], truncated: false },
      }),
      [`RAW /acme/shop/${SHA}/src/auth/login.js`]: () => ({ text: login }),
    });
    const r = await scanLink({ kind: "folder", owner: "acme", repo: "shop", rest: ["feature", "login", "src", "auth"] }, anon, { fetch: gh.fetch });
    expect(r).toMatchObject({ target: "folder", ref: "feature/login", path: "src/auth", title: "src/auth @ feature/login" });
    expect(r.files.map((f) => f.path)).toEqual(["src/auth/login.js"]);
  });

  it("scans a single file and keeps the line range", async () => {
    const gh = fakeGitHub({
      "GET /repos/acme/shop/commits/main": () => ({ json: { sha: SHA } }),
      [`RAW /acme/shop/${SHA}/src/a.js`]: () => ({ text: login }),
    });
    const r = await scanLink({ kind: "file", owner: "acme", repo: "shop", rest: ["main", "src", "a.js"], lines: [2, 4] }, anon, { fetch: gh.fetch });
    expect(r).toMatchObject({ target: "file", path: "src/a.js", lines: [2, 4], url: "https://github.com/acme/shop/blob/main/src/a.js" });
    expect(r.files[0].changedLines).toBeUndefined();
  });

  it("scans only the lines a commit changed", async () => {
    const gh = fakeGitHub({
      "GET /repos/acme/shop/commits/abc1234": () => ({
        json: { sha: SHA, commit: { message: "Fix login\n\nlong text" }, files: [{ filename: "src/a.js", status: "modified", patch: "@@ -1,2 +1,3 @@\n a\n+b\n c" }] },
      }),
      [`RAW /acme/shop/${SHA}/src/a.js`]: () => ({ text: login }),
    });
    const r = await scanLink({ kind: "commit", owner: "acme", repo: "shop", sha: "abc1234" }, anon, { fetch: gh.fetch });
    expect(r).toMatchObject({ target: "commit", title: "Fix login", changedLinesOnly: true });
    expect(r.files[0].changedLines).toEqual([2]);
  });

  it("scans a branch comparison at its head commit", async () => {
    const gh = fakeGitHub({
      "GET /repos/acme/shop/compare/main...feat": () => ({
        json: { html_url: "https://github.com/acme/shop/compare/main...feat", commits: [{ sha: "b".repeat(40) }, { sha: SHA }], files: [{ filename: "src/a.js", status: "added", patch: "@@ -0,0 +1,2 @@\n+x\n+y" }] },
      }),
      [`RAW /acme/shop/${SHA}/src/a.js`]: () => ({ text: login }),
    });
    const r = await scanLink({ kind: "compare", owner: "acme", repo: "shop", base: "main", head: "feat" }, anon, { fetch: gh.fetch });
    expect(r).toMatchObject({ target: "compare", sha: SHA, title: "feat → main" });
    expect(r.files[0].changedLines).toEqual([1, 2]);
  });

  it("explains missing repositories and empty folders", async () => {
    await expect(scanLink({ kind: "repo", owner: "acme", repo: "nope" }, anon, { fetch: fakeGitHub({}).fetch })).rejects.toMatchObject({ code: "not_found" });
    await expect(scanLink({ kind: "repo", owner: "acme", repo: "nope" }, { ...anon, signInAvailable: true }, { fetch: fakeGitHub({}).fetch })).rejects.toMatchObject({
      code: "auth_required",
    });
    await expect(scanLink({ kind: "repo", owner: "acme", repo: "nope" }, { token: "t", asUser: true, signInAvailable: true }, { fetch: fakeGitHub({}).fetch })).rejects.toMatchObject({
      code: "not_installed",
    });
    const gh = fakeGitHub({
      "GET /repos/acme/shop/commits/main": () => ({ json: { sha: SHA } }),
      [`GET /repos/acme/shop/git/trees/${SHA}?recursive=1`]: () => ({ json: { tree: [{ path: "src/a.js", type: "blob" }], truncated: false } }),
    });
    await expect(scanLink({ kind: "folder", owner: "acme", repo: "shop", rest: ["main", "docs"] }, anon, { fetch: gh.fetch })).rejects.toMatchObject({
      message: 'There\'s no folder "docs" on main.',
    });
  });

  it("reads private files through the user's token", async () => {
    const gh = fakeGitHub({
      "GET /repos/acme/vault/commits/main": () => ({ json: { sha: SHA } }),
      [`GET /repos/acme/vault/contents/src/a.js?ref=${SHA}`]: () => ({ text: login }),
    });
    const r = await scanLink({ kind: "file", owner: "acme", repo: "vault", rest: ["main", "src", "a.js"] }, { token: "ghu_x", asUser: true, signInAvailable: true }, { fetch: gh.fetch });
    expect(r.files[0].code).toBe(login);
    expect(gh.calls.every((c) => (c.init?.headers as Record<string, string>)?.Authorization === "Bearer ghu_x")).toBe(true);
  });
});

describe("GitHub issues", () => {
  it("lists every monster that wasn't ignored, linked to its line at the scanned commit", () => {
    let s = reviewReducer(initialState, { type: "start", review: reviewFromScan(fixtureScan()) });
    const review = s.review!;
    const login = review.files.find((f) => f.path.endsWith("cursed-login.js"))!;
    s = reviewReducer(s, { type: "selectFile", fileId: login.id });
    s = reviewReducer(s, { type: "banish", findingId: `${login.id}:possessor:5` });
    s = reviewReducer(s, { type: "ignore", findingId: `${login.id}:zombie:15` });
    const { title, body } = toIssue(s.review!);
    expect(title).toBe("🎃 Cursed Code Review: 13 monsters in acme/shop");
    expect(body).toContain(`[line 5](https://github.com/acme/shop/blob/${"d".repeat(40)}/src/auth/cursed-login.js#L5)`);
    expect(body).toContain("**Possessor · SQL injection** (HIGH)");
    expect(body).toContain("_fix ready_");
    expect(body).not.toContain("Zombie · Dead code** (LOW), [line 15](https://github.com/acme/shop/blob/" + "d".repeat(40) + "/src/auth");
    expect(body).toContain("- [ ] **Twin Ghosts · Race condition**");
  });

  it("explains a missing Issues permission and disabled issues", async () => {
    const gh403 = fakeGitHub({ "POST /repos/o/r/issues": () => ({ status: 403, json: { message: "Resource not accessible by integration" } }) });
    await expect(createIssue("t", { owner: "o", repo: "r", title: "x", body: "y" }, { fetch: gh403.fetch })).rejects.toMatchObject({
      code: "missing_permission",
      message: expect.stringContaining("Issues → Read and write"),
    });
    const gh410 = fakeGitHub({ "POST /repos/o/r/issues": () => ({ status: 410, json: { message: "Issues are disabled for this repo" } }) });
    await expect(createIssue("t", { owner: "o", repo: "r", title: "x", body: "y" }, { fetch: gh410.fetch })).rejects.toMatchObject({ code: "issues_disabled" });
    const ok = fakeGitHub({ "POST /repos/o/r/issues": () => ({ status: 201, json: { html_url: "https://github.com/o/r/issues/9", number: 9 } }) });
    await expect(createIssue("t", { owner: "o", repo: "r", title: "x", body: "y" }, { fetch: ok.fetch })).resolves.toEqual({ url: "https://github.com/o/r/issues/9", number: 9 });
  });
});
