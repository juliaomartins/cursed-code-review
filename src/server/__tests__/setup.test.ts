// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildManifest, createAppUrl } from "@/components/setup/CreateAppForm";
import { getConfig, missingEnv } from "../config";
import { convertManifest } from "../github";

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
      default_permissions: { contents: "read", pull_requests: "write", metadata: "read" },
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
