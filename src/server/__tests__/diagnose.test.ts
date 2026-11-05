// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { explainMissingAccess } from "../diagnose";

const inst = (over: Record<string, unknown> = {}) => ({
  id: 77,
  app_slug: "cursed-code-review",
  html_url: "https://github.com/settings/installations/77",
  repository_selection: "selected",
  permissions: { contents: "write", issues: "write", pull_requests: "write", metadata: "read" },
  account: { login: "juliaomartins" },
  ...over,
});

function fake(installations: unknown[], repos: string[] = []) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/user/installations?")) return new Response(JSON.stringify({ installations }));
    if (url.includes("/user/installations/77/repositories")) return new Response(JSON.stringify({ repositories: repos.map((full_name) => ({ full_name })) }));
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

const need = { permission: "contents" as const, label: "commit code" };
const run = (f: typeof fetch) => explainMissingAccess("tok", "cursed-code-review", "juliaomartins", "playground-cursed", need, { fetch: f });

describe("why GitHub refused", () => {
  it("spots a permission the installation hasn't accepted yet", async () => {
    const e = await run(fake([inst({ permissions: { contents: "read" } })]));
    expect(e).toMatchObject({ code: "permission_not_accepted", installUrl: "https://github.com/settings/installations/77" });
    expect(e.message).toContain("still grants “contents: read”");
    expect(e.message).toContain("Accept new permissions");
  });

  it("spots a repository that isn't selected on the installation", async () => {
    const e = await run(fake([inst()], ["juliaomartins/aprende-ho-cursed"]));
    expect(e).toMatchObject({ code: "repo_not_selected", installUrl: "https://github.com/settings/installations/77" });
    expect(e.message).toContain("juliaomartins/playground-cursed isn't one of the repositories");
  });

  it("spots a missing installation", async () => {
    expect(await run(fake([]))).toMatchObject({ code: "not_installed" });
  });

  it("suggests signing in again when everything looks right", async () => {
    expect(await run(fake([inst({ repository_selection: "all" })]))).toMatchObject({ code: "missing_permission", message: expect.stringContaining("Sign out") });
    expect(await run(fake([inst()], ["juliaomartins/playground-cursed"]))).toMatchObject({ code: "missing_permission" });
  });
});
