import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CryptWorkspace } from "../crypt/CryptWorkspace";
import { reviewFromSamples } from "@/lib/review/factory";
import { KEYS } from "@/lib/storage";
import { renderApp, router, seedReview, setSearch } from "./utils";

const line = (n: number) => document.getElementById(`code-line-${n}`)!;

describe("The Crypt", () => {
  beforeEach(() => {
    setSearch("");
    router.replace.mockClear();
  });

  it("shows the sealed state without a review", async () => {
    renderApp(<CryptWorkspace />);
    expect(await screen.findByRole("heading", { name: "The crypt is sealed." })).toBeInTheDocument();
  });

  it("opens a sample from the deep link and cleans the URL", async () => {
    setSearch("sample=haunted-api");
    renderApp(<CryptWorkspace />);
    expect(await screen.findByRole("heading", { name: "Imp" })).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/crypt", { scroll: false });
    expect(screen.getByRole("button", { name: /haunted-api\.ts/ })).toHaveAttribute("aria-current", "page");
  });

  it("selects a monster from its chip, banishes it and rewrites the code", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<CryptWorkspace />);
    await user.click(await screen.findByRole("button", { name: /Face the Gremlin on line 7/ }));
    expect(screen.getByRole("heading", { name: "Gremlin" })).toBeInTheDocument();
    expect(screen.getByText(/holds a secret written directly/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Banish/ }));
    await waitFor(() => expect(line(7)).toHaveTextContent("const API_KEY = process.env.API_KEY;"));
    expect(screen.queryByRole("button", { name: /Face the Gremlin/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 banished")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /ROOM LIGHT/ })).toHaveAttribute("aria-valuenow", "38");
    expect(await screen.findByText("Gremlin banished")).toBeInTheDocument();
    // next monster is selected automatically
    expect(screen.getByRole("heading", { name: "Void Wraith" })).toBeInTheDocument();
  });

  it("toggles the simple explanation", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<CryptWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Explain it simply" }));
    expect(screen.getByText(/A stranger whispers orders/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(KEYS.prefs)!)).toMatchObject({ explainSimple: true });
  });

  it("supports keyboard spells: next, ignore, undo, lights", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "Possessor" });
    await user.keyboard("j");
    expect(screen.getByRole("heading", { name: "Gremlin" })).toBeInTheDocument();
    await user.keyboard("i");
    expect(screen.getByRole("heading", { name: "Void Wraith" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /GRAVEYARD · 1/ })).toHaveTextContent("Gremlin");
    await user.keyboard("u");
    expect(screen.getByRole("heading", { name: "Gremlin" })).toBeInTheDocument();
    await user.keyboard("l");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: "Keyboard spells" })).toBeInTheDocument();
  });

  it("clears the file and offers the next one", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "Possessor" });
    for (let i = 0; i < 6; i++) {
      await user.keyboard("b");
      await act(async () => {});
    }
    expect(await screen.findByRole("heading", { name: "The crypt is clear." })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /ROOM LIGHT/ })).toHaveAttribute("aria-valuenow", "100");
    await user.click(screen.getByRole("button", { name: /Next: leaky-cache\.py/ }));
    expect(screen.getByRole("heading", { name: "Leech" })).toBeInTheDocument();
  });

  it("restores an ignored monster from the graveyard", async () => {
    const user = userEvent.setup();
    seedReview(reviewFromSamples("cursed-login"));
    renderApp(<CryptWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Ignore" }));
    await user.click(screen.getByRole("button", { name: "Bring back the ignored Possessor" }));
    expect(screen.getByRole("heading", { name: "Possessor" })).toBeInTheDocument();
  });
});
