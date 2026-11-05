import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Doors } from "../home/Doors";
import { KEYS } from "@/lib/storage";
import { fixturePullRequest, fixtureScan } from "@/test/fixtures";
import { mockApi, renderApp, router } from "./utils";

const reduceMotion = () => {
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
};

describe("Home doors", () => {
  beforeEach(() => {
    router.push.mockClear();
    reduceMotion();
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens a cursed sample after the summoning steps", async () => {
    const user = userEvent.setup();
    renderApp(<Doors />);
    await user.click(screen.getByRole("button", { name: /leaky-cache\.py/ }));
    expect(await screen.findByRole("alertdialog", { name: "Opening the crypt" }, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"), { timeout: 3000 });
    const saved = JSON.parse(window.localStorage.getItem(KEYS.review)!);
    expect(saved.review.activeFileId).toBe("leaky-cache");
  });

  it("validates pasted code and detects the language", async () => {
    const user = userEvent.setup();
    renderApp(<Doors />);
    await user.click(screen.getByRole("button", { name: "Summon the monsters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste some code first");
    const box = screen.getByLabelText("Code");
    expect(box).toHaveAttribute("aria-invalid", "true");
    await user.click(box);
    await user.paste("def leak(x):\n    return None");
    expect(screen.getByLabelText("Language")).toHaveValue("python");
    expect(screen.getByText(/Detected Python · 2 lines/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Summon the monsters" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"));
    expect(JSON.parse(window.localStorage.getItem(KEYS.review)!).review.files[0].path).toBe("pasted.py");
  });

  it("validates links before calling GitHub, and says what it detected", async () => {
    const user = userEvent.setup();
    const api = mockApi({ "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }) });
    renderApp(<Doors />);
    const box = screen.getByLabelText("GitHub link");
    await user.type(box, "https://github.com/a/b/issues/3");
    await user.click(screen.getByRole("button", { name: "Open in the crypt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Link to a pull request, file, folder");
    expect(api.mock.calls.some(([u]) => String(u).includes("/api/github/"))).toBe(false);
    await user.clear(box);
    await user.type(box, "github.com/acme/shop/blob/main/src/cart.js#L4-L9");
    expect(screen.getByText("Single file · cart.js · lines 4–9")).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, "acme/shop");
    expect(screen.getByText("Whole repository · acme/shop")).toBeInTheDocument();
  });

  it("opens a public PR in the crypt without signing in", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/scan": () => ({ json: { target: "pr", pr: fixturePullRequest() } }),
    });
    renderApp(<Doors />);
    expect(await screen.findByText("Public repositories. Fetched live from GitHub.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign in/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "a pull request" }));
    expect(screen.getByLabelText("GitHub link")).toHaveValue("https://github.com/juliaomartins/cursed-code-review/pull/1");
    await user.click(screen.getByRole("button", { name: "Open in the crypt" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"));
    const asked = String(vi.mocked(globalThis.fetch).mock.calls.find(([u]) => String(u).includes("/api/github/scan"))![0]);
    expect(decodeURIComponent(asked)).toContain("url=https://github.com/juliaomartins/cursed-code-review/pull/1");
    expect(JSON.parse(window.localStorage.getItem(KEYS.review)!).review.source).toMatchObject({ kind: "pr", label: "kiro-labs/haunted-shop#42", live: true });
  });

  it("opens a whole repository on the Haunted Map", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/scan": () => ({ json: fixtureScan() }),
    });
    renderApp(<Doors />);
    await user.click(await screen.findByRole("button", { name: "a whole repo" }));
    await user.click(screen.getByRole("button", { name: "Open in the crypt" }));
    expect(await screen.findByRole("alertdialog", { name: "Mapping the crypt" }, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/map"), { timeout: 3000 });
    const saved = JSON.parse(window.localStorage.getItem(KEYS.review)!).review;
    expect(saved.source).toMatchObject({ kind: "github", target: "repo", label: "acme/shop", sha: "d".repeat(40) });
    expect(saved.files).toHaveLength(3);
    // the most haunted file opens first
    expect(saved.activeFileId).toBe("gh0");
  });

  it("opens a single file straight in the crypt, with its line range", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/scan": () => ({ json: { ...fixtureScan(), target: "file", path: "src/auth/cursed-login.js", files: fixtureScan().files.slice(0, 1), lines: [5, 8] } }),
    });
    renderApp(<Doors />);
    await user.type(await screen.findByLabelText("GitHub link"), "https://github.com/acme/shop/blob/main/src/auth/cursed-login.js#L5-L8");
    await user.click(screen.getByRole("button", { name: "Open in the crypt" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"), { timeout: 3000 });
    expect(JSON.parse(window.localStorage.getItem(KEYS.review)!).review.files[0].focusLines).toEqual([5, 8]);
  });

  it("shows GitHub's error for a link that can't be opened", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/scan": () => ({ status: 404, json: { code: "not_found", message: "Couldn't find acme/vault#7. Check the link." } }),
    });
    renderApp(<Doors />);
    await user.type(screen.getByLabelText("GitHub link"), "acme/vault#7");
    await user.click(screen.getByRole("button", { name: "Open in the crypt" }));
    expect(await screen.findByText("Couldn't find acme/vault#7. Check the link.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign in with GitHub/ })).not.toBeInTheDocument();
  });

  it("asks visitors to sign in before using GitHub, while samples still work", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, pathname: "/", search: "", hash: "" } as Location);
    mockApi({ "GET /api/auth/session": () => ({ json: { mode: "live", user: null } }) });
    renderApp(<Doors />);
    expect(await screen.findByText("Sign in to see your repositories, open pull requests, and send fixes back.")).toBeInTheDocument();
    expect(screen.queryByLabelText("GitHub link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leaky-cache\.py/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
    await user.click(await screen.findByRole("button", { name: "Continue to GitHub" }));
    expect(assign).toHaveBeenCalledWith("/api/auth/github/login?returnTo=%2F");
  });

  const repos = [
    { owner: "juliaomartins", name: "playground-cursed", fullName: "juliaomartins/playground-cursed", private: true, language: "JavaScript", pushedAt: new Date().toISOString(), defaultBranch: "main", url: "https://github.com/juliaomartins/playground-cursed", description: "Buggy on purpose", archived: false },
    { owner: "juliaomartins", name: "aprende-ho-cursed", fullName: "juliaomartins/aprende-ho-cursed", private: false, language: "JavaScript", pushedAt: "2026-11-01T00:00:00Z", defaultBranch: "main", url: "https://github.com/juliaomartins/aprende-ho-cursed", description: null, archived: false },
  ];
  const live = (extra: Record<string, () => { status?: number; json?: unknown }> = {}) =>
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: { login: "juliaomartins", name: "Julião" } } }),
      "GET /api/github/repos": () => ({ json: { repos, installations: [{ account: "juliaomartins", selection: "selected", manageUrl: "https://github.com/settings/installations/1" }] } }),
      ...extra,
    });

  it("lists your repositories, searches them, and offers to import a missing one", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, pathname: "/", search: "", hash: "" } as Location);
    live();
    renderApp(<Doors />);
    const list = await screen.findByRole("list", { name: "Your repositories" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("playground-cursed"), expect.stringContaining("aprende-ho-cursed")]);
    expect(within(list).getByText("Private repository")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search your repositories"), "aprende");
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    await user.clear(screen.getByLabelText("Search your repositories"));
    await user.type(screen.getByLabelText("Search your repositories"), "secret-project");
    expect(screen.getByText("No repository matches “secret-project”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import a repository" }));
    expect(assign).toHaveBeenCalledWith("/api/auth/github/login?returnTo=%2F&install=1");
  });

  it("opens one of a repository's open pull requests in the crypt", async () => {
    const user = userEvent.setup();
    const api = live({
      "GET /api/github/pulls": () => ({
        json: [
          { number: 4, title: "Add orders module", author: "juliaomartins", draft: false, headRef: "feat/orders", baseRef: "main", updatedAt: new Date().toISOString(), url: "https://github.com/juliaomartins/playground-cursed/pull/4" },
          { number: 3, title: "Profile page", author: "mara", draft: true, headRef: "feat/profile", baseRef: "main", updatedAt: "2026-11-01T00:00:00Z", url: "https://github.com/juliaomartins/playground-cursed/pull/3" },
        ],
      }),
      "GET /api/github/scan": () => ({ json: { target: "pr", pr: fixturePullRequest({ owner: "juliaomartins", repo: "playground-cursed", number: 4 }) } }),
    });
    renderApp(<Doors />);
    await user.click(await screen.findByRole("button", { name: /playground-cursed/ }));
    const prs = await screen.findByRole("list", { name: "Open pull requests" });
    expect(within(prs).getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("OPEN PULL REQUESTS · 2")).toBeInTheDocument();
    await user.click(within(prs).getByRole("button", { name: /Add orders module/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"), { timeout: 3000 });
    const scanned = api.mock.calls.map(([u]) => decodeURIComponent(String(u))).find((u) => u.includes("/api/github/scan"));
    expect(scanned).toContain("url=https://github.com/juliaomartins/playground-cursed/pull/4");
  });

  it("scans a whole repository onto the Haunted Map", async () => {
    const user = userEvent.setup();
    live({
      "GET /api/github/pulls": () => ({ json: [] }),
      "GET /api/github/scan": () => ({ json: fixtureScan({ owner: "juliaomartins", repo: "aprende-ho-cursed" }) }),
    });
    renderApp(<Doors />);
    await user.click(await screen.findByRole("button", { name: /aprende-ho-cursed/ }));
    expect(await screen.findByText("No open pull requests.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Whole repository/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/map"), { timeout: 3000 });
  });

  it("offers to import a repository the app can no longer see", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, pathname: "/", search: "", hash: "" } as Location);
    live({ "GET /api/github/pulls": () => ({ status: 404, json: { code: "not_installed", message: "Cursed Code Review can't see juliaomartins/playground-cursed. Import it to give the app access." } }) });
    renderApp(<Doors />);
    await user.click(await screen.findByRole("button", { name: /playground-cursed/ }));
    await user.click(await screen.findByRole("button", { name: "Import this repository" }));
    expect(assign).toHaveBeenCalledWith("/api/auth/github/login?returnTo=%2F&install=1");
  });
});
