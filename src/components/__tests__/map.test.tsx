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
