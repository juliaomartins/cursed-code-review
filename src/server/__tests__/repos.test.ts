// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { filterPulls, filterRepos, timeAgo } from "@/components/home/RepoDoor";
import { listPulls, listRepos } from "../repos";

const repo = (full: string, pushed: string, extra: Record<string, unknown> = {}) => ({
  name: full.split("/")[1],
  full_name: full,
  owner: { login: full.split("/")[0] },
  private: false,
  language: "JavaScript",
  pushed_at: pushed,
  default_branch: "main",
  html_url: `https://github.com/${full}`,
  description: null,
  ...extra,
});

function fake(routes: Record<string, unknown>) {
  return vi.fn(async (input: string | URL | Request) => {
    const u = new URL(String(input));
    const body = routes[u.pathname + u.search];
    return body === undefined ? new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }) : new Response(JSON.stringify(body));
  }) as unknown as typeof fetch;
}

describe("listRepos", () => {
  it("lists repositories from this app's installations only, newest push first, without duplicates", async () => {
    const f = fake({
      "/user/installations?per_page=100": {
        installations: [
          { id: 1, app_slug: "cursed-code-review", html_url: "https://github.com/settings/installations/1", repository_selection: "selected", account: { login: "julia" } },
          { id: 2, app_slug: "some-other-app", html_url: "x", repository_selection: "all", account: { login: "julia" } },
          { id: 3, app_slug: "cursed-code-review", html_url: "https://github.com/organizations/acme/settings/installations/3", repository_selection: "all", account: { login: "acme" } },
        ],
      },
      "/user/installations/1/repositories?per_page=100&page=1": { repositories: [repo("julia/old", "2025-01-01T00:00:00Z"), repo("julia/new", "2026-11-05T00:00:00Z", { private: true })] },
      "/user/installations/3/repositories?per_page=100&page=1": { repositories: [repo("acme/shop", "2026-06-01T00:00:00Z"), repo("julia/new", "2026-11-05T00:00:00Z")] },
    });
    const res = await listRepos("tok", "cursed-code-review", { fetch: f });
    expect(res.repos.map((r) => r.fullName)).toEqual(["julia/new", "acme/shop", "julia/old"]);
    expect(res.repos[0]).toMatchObject({ owner: "julia", name: "new", private: true, defaultBranch: "main" });
    expect(res.installations).toEqual([
      { account: "julia", selection: "selected", manageUrl: "https://github.com/settings/installations/1" },
      { account: "acme", selection: "all", manageUrl: "https://github.com/organizations/acme/settings/installations/3" },
    ]);
    expect(vi.mocked(f).mock.calls.some(([u]) => String(u).includes("/installations/2/"))).toBe(false);
  });
});

describe("listPulls", () => {
  it("returns open pull requests, newest update first", async () => {
    const f = fake({
      "/repos/julia/new/pulls?state=open&sort=updated&direction=desc&per_page=50": [
        { number: 4, title: "Add orders", draft: false, user: { login: "julia" }, head: { ref: "feat/orders" }, base: { ref: "main" }, updated_at: "2026-11-05T10:00:00Z", html_url: "https://github.com/julia/new/pull/4" },
        { number: 2, title: "WIP", draft: true, user: null, head: { ref: "wip" }, base: { ref: "main" }, updated_at: "2026-11-01T10:00:00Z", html_url: "https://github.com/julia/new/pull/2" },
      ],
    });
    expect(await listPulls("tok", "julia", "new", { fetch: f })).toEqual([
      { number: 4, title: "Add orders", author: "julia", draft: false, headRef: "feat/orders", baseRef: "main", updatedAt: "2026-11-05T10:00:00Z", url: "https://github.com/julia/new/pull/4" },
      { number: 2, title: "WIP", author: "ghost", draft: true, headRef: "wip", baseRef: "main", updatedAt: "2026-11-01T10:00:00Z", url: "https://github.com/julia/new/pull/2" },
    ]);
  });

  it("asks to import a repository the app can't see", async () => {
    await expect(listPulls("tok", "julia", "hidden", { fetch: fake({}) })).rejects.toMatchObject({ code: "not_installed", installUrl: "/api/auth/github/login?install=1" });
  });
});

describe("picker helpers", () => {
  const r = (fullName: string, description: string | null = null) => ({ owner: "", name: "", fullName, private: false, language: null, pushedAt: null, defaultBranch: "main", url: "", description, archived: false });
  it("searches by name, owner or description", () => {
    const list = [r("julia/playground-cursed", "Buggy on purpose"), r("acme/shop")];
    expect(filterRepos(list, "PLAY").map((x) => x.fullName)).toEqual(["julia/playground-cursed"]);
    expect(filterRepos(list, "acme/").map((x) => x.fullName)).toEqual(["acme/shop"]);
    expect(filterRepos(list, "buggy").map((x) => x.fullName)).toEqual(["julia/playground-cursed"]);
    expect(filterRepos(list, " ")).toHaveLength(2);
  });

  it("searches pull requests by number, title, author or branch", () => {
    const p = (number: number, title: string, author = "a", headRef = "b") => ({ number, title, author, draft: false, headRef, baseRef: "main", updatedAt: "", url: "" });
    const list = [p(4, "Add orders"), p(12, "Fix login", "mara", "fix/login")];
    expect(filterPulls(list, "#4").map((x) => x.number)).toEqual([4]);
    expect(filterPulls(list, "mara").map((x) => x.number)).toEqual([12]);
    expect(filterPulls(list, "fix/").map((x) => x.number)).toEqual([12]);
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(timeAgo("2026-11-05T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-05T11:30:00Z", now)).toBe("30m ago");
    expect(timeAgo("2026-11-05T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-11-01T12:00:00Z", now)).toBe("4d ago");
    expect(timeAgo("2026-01-01T12:00:00Z", now)).toBe("Jan 1, 2026");
    expect(timeAgo(null, now)).toBe("");
  });
});
