// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildManifest, createAppUrl } from "@/components/setup/CreateAppForm";
import { getConfig, missingEnv, normalizeSlug } from "../config";
import { checkSetup, convertManifest } from "../github";

afterEach(() => vi.unstubAllEnvs());

describe("one-click GitHub App setup", () => {
  it("describes the app with the callback, permissions and install-time sign-in", () => {
    const m = buildManifest("https://cursed-code-review.vercel.app");
    expect(m).toMatchObject({
      url: "https://cursed-code-review.vercel.app",
      redirect_url: "https://cursed-code-review.vercel.app/setup/complete",
      callback_urls: ["https://cursed-code-review.vercel.app/api/auth/callback/github"],
      public: true,
      request_oauth_on_install: true,
      default_permissions: { contents: "write", pull_requests: "write", issues: "write", metadata: "read" },
    });
    expect(m).not.toHaveProperty("hook_attributes");
    expect(createAppUrl("")).toBe("https://github.com/settings/apps/new");
    expect(createAppUrl(" my org ")).toBe("https://github.com/organizations/my%20org/settings/apps/new");
  });

  it("trades GitHub's one-time code for the app's keys", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            slug: "cursed-code-review",
            name: "Cursed Code Review",
            client_id: "Iv23abc",
            client_secret: "s3cr3t",
            html_url: "https://github.com/apps/cursed-code-review",
            pem: "-----BEGIN",
            owner: { login: "juliaomartins" },
          }),
          { status: 201 },
        ),
    );
    const app = await convertManifest("c0de", { fetch: fetch as unknown as typeof globalThis.fetch });
    expect(app).toEqual({
      slug: "cursed-code-review",
      name: "Cursed Code Review",
      clientId: "Iv23abc",
      clientSecret: "s3cr3t",
      htmlUrl: "https://github.com/apps/cursed-code-review",
      owner: "juliaomartins",
    });
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe("https://api.github.com/app-manifests/c0de/conversions");
    expect(JSON.stringify(app)).not.toContain("BEGIN");
  });

  it("explains a used or expired code", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 404 }));
    await expect(convertManifest("old", { fetch: fetch as unknown as typeof globalThis.fetch })).rejects.toMatchObject({ code: "expired" });
    await expect(convertManifest("../etc", {})).rejects.toMatchObject({ code: "bad_request" });
  });
});

describe("configuration", () => {
  it("needs only the client ID, client secret and slug", () => {
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "Iv23abc");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "s3cr3t");
    vi.stubEnv("GITHUB_APP_SLUG", "");
    vi.stubEnv("SESSION_SECRET", "");
    expect(getConfig()).toBeNull();
    expect(missingEnv()).toEqual(["GITHUB_APP_SLUG"]);
    vi.stubEnv("GITHUB_APP_SLUG", "cursed-code-review");
    const a = getConfig()!;
    expect(a.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(getConfig()!.sessionSecret).toBe(a.sessionSecret); // stable across requests and instances
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "rotated");
    expect(getConfig()!.sessionSecret).not.toBe(a.sessionSecret);
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    expect(getConfig()!.sessionSecret).toBe("x".repeat(40));
  });
});

describe("setup health check", () => {
  const config = { clientId: "Iv23liyT4B70lC5zhvJ2", clientSecret: "s3cr3t", slug: "cursed-code-review", sessionSecret: "x".repeat(40) };
  const fake = (app: number, appBody: unknown, token: number) =>
    vi.fn(async (input: string | URL | Request) =>
      String(input).includes("/apps/") ? new Response(JSON.stringify(appBody), { status: app }) : new Response("{}", { status: token }),
    ) as unknown as typeof fetch;

  it("passes when the slug, Client ID and secret all match", async () => {
    const checks = await checkSetup(config, { fetch: fake(200, { client_id: config.clientId, name: "Cursed Code Review" }, 404) });
    expect(checks.map((c) => [c.id, c.ok])).toEqual([
      ["app", true],
      ["client_id", true],
      ["client_secret", true],
    ]);
  });

  it("spots a wrong secret, a Client ID from another app, and an unknown slug", async () => {
    let checks = await checkSetup(config, { fetch: fake(200, { client_id: config.clientId }, 401) });
    expect(checks.find((c) => c.id === "client_secret")).toMatchObject({ ok: false, fix: expect.stringContaining("Generate a new client secret") });
    checks = await checkSetup(config, { fetch: fake(200, { client_id: "Iv23otherApp9999" }, 404) });
    expect(checks.find((c) => c.id === "client_id")).toMatchObject({ ok: false, fix: expect.stringContaining("…9999") });
    checks = await checkSetup(config, { fetch: fake(404, {}, 404) });
    expect(checks[0]).toMatchObject({ id: "app", ok: false });
  });

  it("sends the credentials only to GitHub's credential check, as Basic auth", async () => {
    const f = fake(200, { client_id: config.clientId }, 404);
    await checkSetup(config, { fetch: f });
    const call = vi.mocked(f).mock.calls.find(([u]) => String(u).includes("/applications/"))!;
    expect(String(call[0])).toBe("https://api.github.com/applications/Iv23liyT4B70lC5zhvJ2/token");
    expect((call[1]?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("Iv23liyT4B70lC5zhvJ2:s3cr3t").toString("base64")}`);
  });
});

describe("GITHUB_APP_SLUG", () => {
  it.each([
    ["cursed-code-review", "cursed-code-review"],
    ["  Cursed-Code-Review  ", "cursed-code-review"],
    ["https://github.com/settings/apps/cursed-code-review", "cursed-code-review"],
    ["https://github.com/settings/apps/cursed-code-review/installations/new", "cursed-code-review"],
    ["https://github.com/apps/cursed-code-review", "cursed-code-review"],
    ["github.com/apps/cursed-code-review/", "cursed-code-review"],
    ["https://github.com/organizations/acme/settings/apps/haunted-bot", "haunted-bot"],
    ['"cursed-code-review"', "cursed-code-review"],
  ])("accepts %j", (input, slug) => {
    expect(normalizeSlug(input)).toBe(slug);
  });

  it.each(["", "   ", "https://github.com/settings", "not a slug!"])("rejects %j", (input) => {
    expect(normalizeSlug(input)).toBeUndefined();
  });

  it("builds a correct install link from a pasted settings URL", () => {
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "Iv23abc");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "s3cr3t");
    vi.stubEnv("GITHUB_APP_SLUG", "https://github.com/settings/apps/cursed-code-review");
    expect(getConfig()?.slug).toBe("cursed-code-review");
    expect(missingEnv()).toEqual([]);
  });
});
