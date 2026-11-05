import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapView } from "../map/MapView";
import { CreateIssueDialog } from "../report/CreateIssueDialog";
import { reviewFromScan } from "@/lib/review/factory";
import { KEYS } from "@/lib/storage";
import { fixtureScan } from "@/test/fixtures";
import { mockApi, renderApp, router, seedReview } from "./utils";

describe("Haunted Map", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows totals and the most haunted files first, and opens one in the crypt", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromScan(fixtureScan()));
    renderApp(<MapView />);
    expect(await screen.findByRole("heading", { name: "14 monsters roam here." })).toBeInTheDocument();
    expect(screen.getByText(/3 files scanned · 3 haunted · 0 clear · 4 skipped/)).toBeInTheDocument();
    const rows = within(screen.getByRole("region", { name: /The rooms/ }) ?? document.body).getAllByRole("button", { name: /^Open / });
    expect(rows[0]).toHaveAccessibleName("Open src/auth/cursed-login.js: 6 monsters lurking");
    await user.click(rows[1]);
    expect(router.push).toHaveBeenCalledWith("/crypt");
    const saved = JSON.parse(window.localStorage.getItem(KEYS.review)!).review;
    expect(saved.files.find((f: { id: string }) => f.id === saved.activeFileId).path).not.toBe("src/auth/cursed-login.js");
  });

  it("lets you rescan a folder when the repository was too big", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }),
      "GET /api/github/scan": () => ({ json: fixtureScan({ target: "folder", path: "src", title: "src @ main" }) }),
    });
    seedReview(reviewFromScan(fixtureScan({ truncated: { total: 120, scanned: 40, folders: [{ path: "src", count: 90 }, { path: "(root)", count: 3 }] } })));
    renderApp(<MapView />);
    expect(await screen.findByText(/has 120 files the crypt can read/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^src\// }));
    const asked = api.mock.calls.map(([u]) => decodeURIComponent(String(u))).find((u) => u.includes("/api/github/scan"));
    expect(asked).toContain("url=https://github.com/acme/shop/tree/main/src");
  });

  it("groups files by folder", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromScan(fixtureScan()));
    renderApp(<MapView />);
    await user.click(await screen.findByRole("button", { name: "By folder" }));
    expect(screen.getByRole("heading", { name: "src/auth/" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "services/" })).toBeInTheDocument();
  });
});

describe("Create GitHub issue", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates an issue on the scanned repository", async () => {
    const user = userEvent.setup();
    let sent: Record<string, string> = {};
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: { login: "octo", name: "Octo" } } }),
      "POST /api/github/issue": (init) => {
        sent = JSON.parse(String(init?.body));
        return { json: { url: "https://github.com/acme/shop/issues/7", number: 7 } };
      },
    });
    const review = reviewFromScan(fixtureScan());
    seedReview(review);
    renderApp(<CreateIssueDialog open onClose={() => {}} review={review} />);
    const dialog = await screen.findByRole("dialog", { name: "Create a GitHub issue" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("🎃 Cursed Code Review: 14 monsters in acme/shop");
    await user.click(await within(dialog).findByRole("button", { name: "Create issue" }));
    expect(await screen.findByText("Issue #7 created")).toBeInTheDocument();
    expect(sent).toMatchObject({ owner: "acme", repo: "shop" });
    expect(sent.body).toContain("Possessor · SQL injection");
  });
});

describe("Open a fix PR", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends one commit per fixed file, with the scanned file's hash, to a new branch", async () => {
    const { ApplyFixesDialog } = await import("../report/ApplyFixesDialog");
    const { reviewReducer, initialState } = await import("@/lib/review/reducer");
    const user = userEvent.setup();
    let sent: { owner: string; files: { path: string; originalHash: string; message: string }[]; target: Record<string, unknown> } | null = null;
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: { login: "octo", name: "Octo" } } }),
      "POST /api/github/fixes": (init) => {
        sent = JSON.parse(String(init?.body));
        return { json: { url: "https://github.com/acme/shop/pull/12", branch: "cursed-fixes/x", commits: 1, skipped: [] } };
      },
    });
    let s = reviewReducer(initialState, { type: "start", review: reviewFromScan(fixtureScan()) });
    const login = s.review!.files.find((f) => f.path.endsWith("cursed-login.js"))!;
    s = reviewReducer(s, { type: "banish", findingId: `${login.id}:gremlin:7` });
    seedReview(s.review!);
    renderApp(<ApplyFixesDialog open onClose={() => {}} review={s.review!} />);
    const dialog = await screen.findByRole("dialog", { name: "Open a fix pull request" });
    expect(within(dialog).getByText(/One commit per file \(1 commit, 1 fix\)/)).toBeInTheDocument();
    expect((within(dialog).getByLabelText("New branch") as HTMLInputElement).value).toMatch(/^cursed-fixes\/\d{4}-\d{2}-\d{2}-ddddddd$/);
    await user.click(within(dialog).getByRole("button", { name: "Open fix pull request" }));
    expect(await within(dialog).findByText("Your fix pull request is open.")).toBeInTheDocument();
    expect(sent!.owner).toBe("acme");
    expect(sent!.files).toHaveLength(1);
    expect(sent!.files[0].path).toBe("src/auth/cursed-login.js");
    expect(sent!.files[0].originalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sent!.target).toMatchObject({ kind: "newBranch", baseBranch: "main", baseSha: "d".repeat(40), title: "🔥 Banish 1 monster" });
  });
});
