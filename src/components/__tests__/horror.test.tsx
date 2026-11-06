import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CryptWorkspace } from "../crypt/CryptWorkspace";
import { BanishBurst } from "../fx/BanishBurst";
import { SignInDialog } from "../auth/SignInDialog";
import { ToastProvider } from "../ui/Toast";
import { AuthProvider } from "@/providers/AuthProvider";
import { ReviewProvider } from "@/providers/ReviewProvider";
import { reviewFromSamples } from "@/lib/review/factory";
import type { Review } from "@/lib/types";
import { seedReview, setSearch } from "./utils";

/** The crypt with a real banishment length, so the animation and the fix can be observed apart. */
function renderSlow(banishMs = 300) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ReviewProvider banishMs={banishMs}>
          <CryptWorkspace />
          <SignInDialog />
        </ReviewProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}

const reduce = (on: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes("reduce"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const chip = (name: RegExp) => screen.getByRole("button", { name });
const creatureIn = (el: HTMLElement) => el.querySelector<HTMLElement>("[data-creature]")!;
const loginOnly = (): Review => {
  const r = reviewFromSamples("cursed-login");
  return { ...r, files: r.files.filter((f) => f.id === "cursed-login") };
};

describe("Horror: creatures follow their findings", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    setSearch("");
    reduce(false);
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("monsters emerge from their own lines, in reading order", async () => {
    seedReview(loginOnly());
    renderSlow();
    await screen.findByRole("heading", { name: "The Crypt" });
    const possessor = creatureIn(chip(/Face the Possessor on line 5/));
    const gremlin = creatureIn(chip(/Face the Gremlin on line 7/));
    expect(possessor).toHaveAttribute("data-state", "emerging");
    expect(possessor.closest("[data-line]")).toHaveAttribute("data-line", "5");
    const delay = (el: HTMLElement) => parseFloat(el.style.getPropertyValue("--ed"));
    expect(delay(gremlin)).toBeGreaterThan(delay(possessor));
    expect(document.querySelector("#code-line-5 .line-summon")).not.toBeNull();
  });

  it("a creature reacts when it is selected, and severity sets its intensity", async () => {
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderSlow();
    await screen.findByRole("heading", { name: "The Crypt" });
    const gremlin = chip(/Face the Gremlin on line 7/);
    expect(creatureIn(gremlin)).toHaveClass("cr-sev-CRITICAL");
    expect(creatureIn(chip(/Face the Imp/))).toHaveClass("cr-sev-LOW");
    await user.click(gremlin);
    await waitFor(() => expect(creatureIn(chip(/Face the Gremlin on line 7/))).toHaveAttribute("data-state", "reacting"));
  });

  it.each([
    [/Face the Possessor/, "runes"],
    [/Face the Gremlin/, "sparks"],
    [/Face the Void Wraith/, "smoke"],
    [/Face the Imp/, "embers"],
    [/Face the Leech/, "energy"],
  ])("%s dies its own death, and the fix lands only when the banishment ends", async (name, fx) => {
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderSlow(300);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.click(chip(name));
    const line = chip(name).closest("[data-line]")!.getAttribute("data-line")!;
    const codeOf = () => document.querySelector(`#code-line-${line} code`)!.textContent;
    const before = codeOf();
    await user.click(screen.getByRole("button", { name: "Banish" }));
    const banishing = creatureIn(chip(name));
    expect(banishing).toHaveAttribute("data-state", "banishing");
    expect(banishing.querySelector(`[data-fx="${fx}"]`)).not.toBeNull();
    // Spectacle first, but the code is untouched until the (pre-verified) fix is applied.
    expect(codeOf()).toBe(before);
    await waitFor(() => expect(screen.queryByRole("button", { name })).not.toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByRole("progressbar", { name: /ROOM LIGHT/ })).not.toHaveAttribute("aria-valuenow", "25");
  });

  it("a fix that no longer applies is never shown as a banishment: the creature resists", async () => {
    const user = userEvent.setup();
    const r = loginOnly();
    const file = r.files[0];
    const possessor = file.findings.find((f) => f.kind === "possessor")!;
    // Someone changed the line under the monster: its fix can no longer be located.
    const lines = file.code.split("\n");
    lines[possessor.fix.startLine - 1] = "  // rewritten by hand";
    r.files[0] = {
      ...file,
      code: lines.join("\n"),
      findings: file.findings.map((f) => (f.id === possessor.id ? { ...f, fix: { ...f.fix, before: ["no such line anywhere"] } } : f)),
    };
    r.selectedFindingId = possessor.id;
    seedReview(r);
    renderSlow(300);
    await screen.findByRole("heading", { name: "Possessor" });
    const code = () => Array.from(document.querySelectorAll('[aria-label^="Code of"] code'), (c) => c.textContent).join("\n");
    const codeBefore = code();
    await user.click(screen.getByRole("button", { name: "Banish" }));
    expect(await screen.findByText("The Possessor resists")).toBeInTheDocument();
    expect(document.querySelector("[data-fx]")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/fix no longer applies cleanly/);
    expect(code()).toBe(codeBefore);
  });

  it("under reduced motion the fix applies at once and nothing flies", async () => {
    reduce(true);
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderSlow(300);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.click(chip(/Face the Gremlin/));
    await user.click(screen.getByRole("button", { name: "Banish" }));
    expect(screen.queryByRole("button", { name: /Face the Gremlin/ })).not.toBeInTheDocument();
    expect(document.querySelector("[data-fx]")).toBeNull();
    expect(document.getElementById("code-line-7")).toHaveTextContent("process.env.API_KEY");
  });

  it("BanishBurst draws nothing under reduced motion, and runes otherwise", () => {
    const { container, rerender } = render(<BanishBurst kind="possessor" severity="HIGH" />);
    expect(container.querySelectorAll('[data-fx="runes"] .fx-p')).toHaveLength(22);
    reduce(true);
    rerender(<BanishBurst kind="possessor" severity="LOW" seed={2} />);
    expect(container.querySelector("[data-fx]")).toBeNull();
  });

  it("undo brings a banished creature back, climbing out again", async () => {
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderSlow(0);
    await screen.findByRole("heading", { name: "The Crypt" });
    await user.click(chip(/Face the Zombie/));
    await user.click(screen.getByRole("button", { name: "Banish" }));
    expect(screen.queryByRole("button", { name: /Face the Zombie/ })).not.toBeInTheDocument();
    await act(async () => {
      await user.keyboard("u");
    });
    const back = await screen.findByRole("button", { name: /Face the Zombie/ });
    expect(within(back).getByText("Zombie")).toBeInTheDocument();
    expect(creatureIn(back)).toHaveAttribute("data-state", "emerging");
  });
});
