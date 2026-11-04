import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportView } from "../report/ReportView";
import { fetchPullRequest } from "@/lib/github";
import { reviewFromPullRequest, reviewFromSamples } from "@/lib/review/factory";
import { reviewReducer, initialState } from "@/lib/review/reducer";
import { KEYS } from "@/lib/storage";
import { renderApp, seedReview } from "./utils";

describe("Report", () => {
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

  it("posts a PR review after signing in", async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pr = await fetchPullRequest({ owner: "kiro-labs", repo: "haunted-shop", number: 42 }, { signedIn: true, latencyMs: 0 });
    seedReview(reviewFromPullRequest(pr));
    window.localStorage.setItem(KEYS.user, JSON.stringify({ login: "midnight-dev", name: "Midnight Dev" }));
    renderApp(<ReportView />);
    await user.click(await screen.findByRole("button", { name: /Post review to GitHub PR/ }));
    const dialog = screen.getByRole("dialog", { name: "Post review to GitHub" });
    expect(within(dialog).getByRole("radio", { name: /Request changes/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Approve/ })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Post change request" }));
    await vi.advanceTimersByTimeAsync(1500);
    await waitFor(() => expect(within(dialog).getByText("Your review is on the pull request.")).toBeInTheDocument());
    expect(within(dialog).getByRole("link", { name: /View review on GitHub/ })).toHaveAttribute("href", expect.stringContaining("kiro-labs/haunted-shop/pull/42#pullrequestreview-"));
    vi.useRealTimers();
  });
});
