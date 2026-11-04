import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Doors } from "../home/Doors";
import { KEYS } from "@/lib/storage";
import { fixturePullRequest } from "@/test/fixtures";
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
    expect(screen.getByRole("alertdialog", { name: "Opening the crypt" })).toBeInTheDocument();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"));
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

  it("validates PR links before calling GitHub", async () => {
    const user = userEvent.setup();
    const api = mockApi({ "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }) });
    renderApp(<Doors />);
    await user.type(screen.getByLabelText("Pull request link"), "https://github.com/a/b/issues/3");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Link to a pull request");
    expect(api.mock.calls.some(([u]) => String(u).includes("/api/github/pr"))).toBe(false);
  });

  it("opens a public PR from GitHub without signing in", async () => {
    const user = userEvent.setup();
    let asked = "";
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/pr": () => {
        return { json: fixturePullRequest() };
      },
    }).mockName("api");
    renderApp(<Doors />);
    expect(await screen.findByText("Public repositories. Fetched live from GitHub.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign in/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "juliaomartins/cursed-code-review#1" }));
    expect(screen.getByLabelText("Pull request link")).toHaveValue("https://github.com/juliaomartins/cursed-code-review/pull/1");
    await user.clear(screen.getByLabelText("Pull request link"));
    await user.type(screen.getByLabelText("Pull request link"), "kiro-labs/haunted-shop#42");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"));
    asked = String(vi.mocked(globalThis.fetch).mock.calls.find(([u]) => String(u).includes("/api/github/pr"))![0]);
    expect(decodeURIComponent(asked)).toContain("url=https://github.com/kiro-labs/haunted-shop/pull/42");
    const source = JSON.parse(window.localStorage.getItem(KEYS.review)!).review.source;
    expect(source).toMatchObject({ kind: "pr", label: "kiro-labs/haunted-shop#42", live: true });
  });

  it("shows GitHub's error for a PR that can't be opened", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/pr": () => ({ status: 404, json: { code: "not_found", message: "Couldn't find acme/vault#7. Check the link." } }),
    });
    renderApp(<Doors />);
    await user.type(screen.getByLabelText("Pull request link"), "acme/vault#7");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    expect(await screen.findByText("Couldn't find acme/vault#7. Check the link.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign in with GitHub/ })).not.toBeInTheDocument();
  });

  it("offers GitHub sign-in for private repos when the GitHub App is connected", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, pathname: "/", search: "", hash: "" } as Location);
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: null } }),
      "GET /api/github/pr": () => ({ status: 401, json: { code: "auth_required", message: "If the repository is private, sign in with GitHub." } }),
    });
    renderApp(<Doors />);
    expect(await screen.findByText("Public repos work right away. Sign in with GitHub for private ones.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pull request link"), "acme/vault#7");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    await user.click(await screen.findByRole("button", { name: "Sign in with GitHub" }));
    expect(window.sessionStorage.getItem("ccr:pr-draft")).toBe("acme/vault#7");
    await user.click(await screen.findByRole("button", { name: "Continue to GitHub" }));
    expect(assign).toHaveBeenCalledWith("/api/auth/github/login?returnTo=%2F");
  });

  it("offers to install the app when it can't see the repository", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, pathname: "/", search: "", hash: "" } as Location);
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: { login: "octo", name: "Octo" } } }),
      "GET /api/github/pr": () => ({ status: 404, json: { code: "not_installed", message: "Cursed Code Review isn't installed on that repository yet." } }),
    });
    renderApp(<Doors />);
    await user.type(await screen.findByLabelText("Pull request link"), "acme/vault#7");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    await user.click(await screen.findByRole("button", { name: "Install on this repository" }));
    expect(assign).toHaveBeenCalledWith("/api/auth/github/login?returnTo=%2F&install=1");
  });
});
