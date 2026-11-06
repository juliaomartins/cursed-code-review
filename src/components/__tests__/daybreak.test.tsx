import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CryptWorkspace } from "../crypt/CryptWorkspace";
import { ReportView } from "../report/ReportView";
import { reviewFromPaste, reviewFromSamples } from "@/lib/review/factory";
import { isDaybreak, statsOf } from "@/lib/review/selectors";
import { renderApp, seedReview, setSearch } from "./utils";

const oneZombie = () => reviewFromPaste("function f() {\n  return 1;\n  console.log('never');\n}\n", "javascript");
const daybreakOn = () => document.documentElement.dataset.daybreak === "on";

describe("Daybreak", () => {
  beforeEach(() => setSearch(""));

  it("needs every monster gone and at least one banished", () => {
    const f = oneZombie().files[0].findings[0];
    expect(isDaybreak(statsOf([f]))).toBe(false);
    expect(isDaybreak(statsOf([{ ...f, status: "ignored" }]))).toBe(false);
    expect(isDaybreak(statsOf([{ ...f, status: "banished" }]))).toBe(true);
  });

  it("stays night while monsters lurk", async () => {
    seedReview(reviewFromSamples());
    renderApp(<CryptWorkspace />);
    expect(await screen.findByRole("heading", { name: "The Crypt" })).toBeInTheDocument();
    expect(daybreakOn()).toBe(false);
    expect(screen.getByRole("switch", { name: /Lights/ })).toBeInTheDocument();
  });

  it("turns the crypt to daylight when the last monster is banished, and undo brings the night back", async () => {
    const user = userEvent.setup();
    seedReview(oneZombie());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.keyboard("j");
    await user.click(await screen.findByRole("button", { name: "Banish" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Daybreak" })).toBeInTheDocument();
    expect(daybreakOn()).toBe(true);
    expect(screen.getByText("DAYLIGHT · 100%")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Lights/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Daybreak." })).toBeInTheDocument();

    // The finale: the hunt's numbers and the way to the report.
    const finale = screen.getByRole("dialog", { name: "THE CRYPT IS CLEANSED" });
    const stat = (label: string) => within(finale).getByText(label, { selector: "dt" }).previousElementSibling;
    expect(stat("Monsters discovered")).toHaveTextContent("1");
    expect(stat("Banished")).toHaveTextContent("1");
    expect(stat("Ignored")).toHaveTextContent("0");
    expect(stat("Fixes applied")).toHaveTextContent("1");
    expect(stat("Room light")).toHaveTextContent("100%");
    expect(within(finale).getByRole("link", { name: /See the final report/ })).toHaveAttribute("href", "/report");
    expect(within(finale).getByRole("link", { name: /See the final report/ })).toHaveFocus();

    // Undo from the finale: the night comes back and the monster climbs out again.
    await user.click(within(finale).getByRole("button", { name: "Undo the last banish" }));
    expect(await screen.findByRole("heading", { level: 1, name: "The Crypt" })).toBeInTheDocument();
    expect(daybreakOn()).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Face the Zombie/ })).toBeInTheDocument();
  });

  it("closing the finale keeps the daylight, and Escape works too", async () => {
    const user = userEvent.setup();
    seedReview(oneZombie());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.keyboard("j");
    await user.click(await screen.findByRole("button", { name: "Banish" }));
    await screen.findByRole("dialog", { name: "THE CRYPT IS CLEANSED" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(daybreakOn()).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Daybreak" })).toBeInTheDocument();
  });

  it("the report of a cleansed scan is in daylight too, and leaving it returns to night", async () => {
    const r = oneZombie();
    r.files[0].findings[0].status = "banished";
    seedReview(r);
    const view = renderApp(<ReportView />);
    expect(await screen.findByText(/DAYLIGHT 100%/)).toBeInTheDocument();
    expect(daybreakOn()).toBe(true);
    view.unmount();
    expect(daybreakOn()).toBe(false);
  });
});
