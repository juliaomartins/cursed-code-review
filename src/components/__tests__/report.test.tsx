import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportView } from "../report/ReportView";
import { fixturePullRequest } from "@/test/fixtures";
import { reviewFromPullRequest, reviewFromSamples } from "@/lib/review/factory";
import { reviewReducer, initialState } from "@/lib/review/reducer";
import { mockApi, renderApp, seedReview } from "./utils";

describe("Report", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an empty state without a review", async () => {
    renderApp(<ReportView />);
    expect(await screen.findByRole("heading", { name: "No hunt to report." })).toBeInTheDocument();
  });

  it("summarises the hunt and lists every monster with its status", async () => {
    let s = reviewReducer(initialState, { type: "start", review: reviewFromSamples("cursed-login") });
    s = reviewReducer(s, { type: "banish", findingId: "cursed-login:possessor:5" });
    seedReview(s.review!);
    renderApp(<ReportView />);
    expect(await screen.findByRole("heading", { name: "The crypt still stirs." })).toBeInTheDocument();
    expect(screen.getByTestId("stat-Monsters found")).toHaveTextContent("14");
    expect(screen.getByTestId("stat-Banished (fixed)")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-Still lurking")).toHaveTextContent("13");
    const rows = within(screen.getByRole("table", { name: "What lurked in the code" })).getAllByRole("row");
    expect(rows).toHaveLength(15);
    expect(rows[1]).toHaveTextContent(/Possessor.*cursed-login\.js.*5.*SQL injection.*HIGH.*Banished/);
    expect(screen.getByRole("button", { name: /Post review to GitHub PR/ })).toBeDisabled();
  });

  it("exports the report as markdown", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => "blob:report");
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<ReportView />);
    await user.click(await screen.findByRole("button", { name: /Export report/ }));
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText("Report exported")).toBeInTheDocument();
  });

  it("posts a review to the real PR when signed in", async () => {
    const user = userEvent.setup();
    let posted: Record<string, unknown> = {};
    mockApi({
      "GET /api/auth/session": () => ({ json: { mode: "live", user: { login: "octo", name: "Octo Cat" } } }),
      "POST /api/github/review": (init) => {
        posted = JSON.parse(String(init?.body));
        return { json: { url: "https://github.com/kiro-labs/haunted-shop/pull/42#pullrequestreview-9", inline: 5, folded: 1 } };
      },
    });
    seedReview(reviewFromPullRequest(fixturePullRequest()));
    renderApp(<ReportView />);
    await user.click(await screen.findByRole("button", { name: /Post review to GitHub PR/ }));
    const dialog = screen.getByRole("dialog", { name: "Post review to GitHub" });
    expect(within(dialog).getByRole("radio", { name: /Request changes/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Approve/ })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Post change request" }));
    expect(await within(dialog).findByText("Your review is on the pull request.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /View review on GitHub/ })).toHaveAttribute("href", "https://github.com/kiro-labs/haunted-shop/pull/42#pullrequestreview-9");
    expect(posted).toMatchObject({ owner: "kiro-labs", repo: "haunted-shop", number: 42, commitId: "c".repeat(40), event: "REQUEST_CHANGES" });
    expect((posted.comments as unknown[]).length).toBeGreaterThan(0);
    expect(await screen.findByText("5 inline comments on kiro-labs/haunted-shop#42.")).toBeInTheDocument();
  });

  it("explains that posting is unavailable until GitHub sign-in is connected", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/auth/session": () => ({ json: { mode: "off", user: null } }) });
    seedReview(reviewFromPullRequest(fixturePullRequest()));
    renderApp(<ReportView />);
    await user.click(await screen.findByRole("button", { name: /Post review to GitHub PR/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("isn't available on this site yet");
  });
});
