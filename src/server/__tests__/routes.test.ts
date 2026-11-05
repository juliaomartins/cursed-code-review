// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callback } from "@/app/api/auth/callback/github/route";
import { GET as login } from "@/app/api/auth/github/login/route";
import { GET as session } from "@/app/api/auth/session/route";
import { GET as pr } from "@/app/api/github/pr/route";
import { POST as review } from "@/app/api/github/review/route";
import { seal, SESSION_COOKIE, STATE_COOKIE } from "../session";

const SECRET = "s".repeat(40);
const ENV = { GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "cursed-code-review", SESSION_SECRET: SECRET };
const BASE = "https://ccr.example";

const req = (path: string, cookies: Record<string, string> = {}, init?: RequestInit) =>
  new NextRequest(`${BASE}${path}`, {
    ...init,
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
      ...(init?.headers ?? {}),
    },
  } as ConstructorParameters<typeof NextRequest>[1]);

const cookieValue = (res: Response, name: string) => /([^=]+)=([^;]*)/.exec(res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? "")?.[2];

describe("auth routes", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports that sign-in is off when the GitHub App is not configured", async () => {
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "");
    expect(await (await session(req("/api/auth/session"))).json()).toEqual({ mode: "off", user: null, missing: ["GITHUB_APP_CLIENT_ID"] });
    expect(login(req("/api/auth/github/login")).headers.get("location")).toBe(`${BASE}/?auth=not_configured`);
  });

  it("works without SESSION_SECRET by deriving a key from the client secret", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    const res = login(req("/api/auth/github/login"));
    expect(res.headers.get("location")).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
    const who = await (await session(req("/api/auth/session"))).json();
    expect(who.mode).toBe("live");
  });

  it("redirects to GitHub with the callback URL and a state cookie", () => {
    const res = login(req("/api/auth/github/login?returnTo=/report"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(loc.searchParams.get("client_id")).toBe("Iv1.abc");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${BASE}/api/auth/callback/github`);
    expect(loc.searchParams.get("state")).toMatch(/^[0-9a-f]{32}$/);
    expect(cookieValue(res, STATE_COOKIE)).toBeTruthy();
    expect(res.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);
  });

  it("sends installs to the app's install page", () => {
    const loc = login(req("/api/auth/github/login?install=1")).headers.get("location")!;
    expect(loc).toMatch(/^https:\/\/github\.com\/apps\/cursed-code-review\/installations\/new\?state=[0-9a-f]{32}$/);
  });

  it("completes sign-in: checks state, exchanges the code, stores an encrypted session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://github.com/login/oauth/access_token"))
        return new Response(JSON.stringify({ access_token: "ghu_1", refresh_token: "ghr_1", expires_in: 28800 }));
      if (url === "https://api.github.com/user")
        return new Response(JSON.stringify({ login: "octo", name: "Octo Cat", avatar_url: "https://avatars.githubusercontent.com/u/1" }));
      return new Response("{}", { status: 404 });
    });
    const state = seal({ state: "abc", returnTo: "/report" }, SECRET);
    const res = await callback(req("/api/auth/callback/github?code=c0de&state=abc", { [STATE_COOKIE]: state }));
    expect(res.headers.get("location")).toBe(`${BASE}/report?auth=success`);
    const sealed = cookieValue(res, SESSION_COOKIE)!;
    expect(sealed).not.toContain("ghu_1");
    expect(Object.fromEntries(new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)))).toMatchObject({
      code: "c0de",
      redirect_uri: `${BASE}/api/auth/callback/github`,
    });

    const who = await (await session(req("/api/auth/session", { [SESSION_COOKIE]: sealed }))).json();
    expect(who).toMatchObject({ mode: "live", user: { login: "octo", name: "Octo Cat" } });
    expect(JSON.stringify(who)).not.toContain("ghu_1");
  });

  it("reports GitHub's reason when the code exchange fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "incorrect_client_credentials", error_description: "The client_id and/or client_secret passed are incorrect." })),
    );
    const state = seal({ state: "abc", returnTo: "/" }, SECRET);
    const res = await callback(req("/api/auth/callback/github?code=c0de&state=abc", { [STATE_COOKIE]: state }));
    expect(res.headers.get("location")).toBe(`${BASE}/?auth=error&reason=incorrect_client_credentials`);
  });

  it("treats a reloaded callback as success when the first attempt already signed you in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." })));
    const state = seal({ state: "abc", returnTo: "/" }, SECRET);
    const signedIn = seal({ user: { login: "elyzio", name: "Elyzio", avatarUrl: "" }, accessToken: "ghu_x" }, SECRET);
    const url = "/api/auth/callback/github?code=used&installation_id=1&setup_action=install&state=abc";
    expect((await callback(req(url, { [STATE_COOKIE]: state, [SESSION_COOKIE]: signedIn }))).headers.get("location")).toBe(`${BASE}/?auth=installed`);
  });

  it("quietly retries a first sign-in whose answer was lost, but only once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: "bad_verification_code" })));
    const url = "/api/auth/callback/github?code=used&installation_id=1&setup_action=install&state=abc";
    // First failure, no session yet: start sign-in again, flagged as a retry.
    const first = await callback(req(url, { [STATE_COOKIE]: seal({ state: "abc", returnTo: "/report" }, SECRET) }));
    expect(first.headers.get("location")).toBe(`${BASE}/api/auth/github/login?returnTo=%2Freport&retry=1`);
    // The retry's own failure is reported, not retried again.
    const second = await callback(req(url, { [STATE_COOKIE]: seal({ state: "abc", returnTo: "/report", retry: true }, SECRET) }));
    expect(second.headers.get("location")).toBe(`${BASE}/report?auth=error&reason=bad_verification_code`);
  });

  it("remembers that a sign-in is the automatic retry", async () => {
    const res = login(req("/api/auth/github/login?returnTo=/report&retry=1"));
    const { unseal } = await import("../session");
    expect(unseal(cookieValue(res, STATE_COOKIE), SECRET)).toMatchObject({ returnTo: "/report", retry: true });
  });

  it("explains a missing state cookie", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await callback(req("/api/auth/callback/github?code=c0de&state=abc"));
    expect(res.headers.get("location")).toBe(`${BASE}/?auth=error&reason=state_missing`);
  });

  it("rejects a callback whose state does not match", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = seal({ state: "abc", returnTo: "/" }, SECRET);
    const res = await callback(req("/api/auth/callback/github?code=c0de&state=evil", { [STATE_COOKIE]: state }));
    expect(res.headers.get("location")).toBe(`${BASE}/?auth=error&reason=state_mismatch`);
    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
  });

  it("reports a cancelled authorization", async () => {
    const res = await callback(req("/api/auth/callback/github?error=access_denied"));
    expect(res.headers.get("location")).toBe(`${BASE}/?auth=denied&reason=access_denied`);
  });
});

describe("GitHub data routes", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("open public PRs without signing in, and suggest sign-in for anything else", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
    const res = await pr(req("/api/github/pr?url=https://github.com/o/r/pull/1"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "auth_required" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.github.com/repos/o/r/pulls/1");
  });

  it("work without any GitHub App configured", async () => {
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
    const res = await pr(req("/api/github/pr?url=https://github.com/o/r/pull/1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "not_found" });
  });

  it("require sign-in to post reviews", async () => {
    const res = await review(
      req(
        "/api/github/review",
        {},
        { method: "POST", body: JSON.stringify({ owner: "o", repo: "r", number: 1, commitId: "a".repeat(40), event: "COMMENT", body: "x", comments: [] }) },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("validate input", async () => {
    expect((await pr(req("/api/github/pr?url=nope"))).status).toBe(400);
    const bad = await review(req("/api/github/review", {}, { method: "POST", body: JSON.stringify({ owner: "o" }) }));
    expect(bad.status).toBe(400);
  });

  it("signs the user out when GitHub rejects the token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));
    const sealed = seal({ user: { login: "u", name: "u", avatarUrl: "" }, accessToken: "t" }, SECRET);
    const res = await pr(req("/api/github/pr?url=https://github.com/o/r/pull/1", { [SESSION_COOKIE]: sealed }));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(/Max-Age=0/i);
  });
});
