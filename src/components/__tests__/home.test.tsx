import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Doors } from "../home/Doors";
import { KEYS } from "@/lib/storage";
import { renderApp, router } from "./utils";

const reduceMotion = () => {
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
};

describe("Home doors", () => {
  beforeEach(() => {
    router.push.mockClear();
    reduceMotion();
  });

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

  it("validates PR links", async () => {
    const user = userEvent.setup();
    renderApp(<Doors />);
    await user.type(screen.getByLabelText("Pull request link"), "https://github.com/a/b/issues/3");
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Link to a pull request");
  });

  it("asks for sign-in on private repos, then opens the PR", async () => {
    const user = userEvent.setup();
    renderApp(<Doors />);
    await user.click(screen.getByRole("button", { name: "acme/private-vault#7" }));
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    expect(await screen.findByText(/This repository is private/, {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
    await user.click(await screen.findByRole("button", { name: "Authorize" }));
    expect(await screen.findByText("Signed in as @midnight-dev")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open the PR in the crypt" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/crypt"), { timeout: 4000 });
    expect(JSON.parse(window.localStorage.getItem(KEYS.review)!).review.source).toMatchObject({ kind: "pr", label: "acme/private-vault#7" });
  });
});
