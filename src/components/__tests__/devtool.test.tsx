import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CryptWorkspace } from "../crypt/CryptWorkspace";
import { reviewFromPaste, reviewFromSamples } from "@/lib/review/factory";
import { renderApp, seedReview, setSearch } from "./utils";

const loginOnly = () => {
  const r = reviewFromSamples("cursed-login");
  return { ...r, files: r.files.filter((f) => f.id === "cursed-login") };
};

describe("Developer workflow in the crypt", () => {
  beforeEach(() => setSearch(""));

  it("shows the rule, category, confidence, exact location, references and exposure", async () => {
    seedReview(loginOnly());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "Possessor" });
    expect(screen.getByText("sql-injection")).toBeInTheDocument();
    expect(screen.getByText(/^L5:C\d+$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CWE-89/ })).toHaveAttribute("href", "https://cwe.mitre.org/data/definitions/89.html");
    expect(screen.getByText("Untrusted input reaches this line")).toBeInTheDocument();
    expect(screen.getByText("Impact.")).toBeInTheDocument();
    expect(screen.getByText("How to fix.")).toBeInTheDocument();
  });

  it("a finding without a safe automatic fix explains why and cannot be banished", async () => {
    const user = userEvent.setup();
    seedReview(
      reviewFromPaste("const { exec } = require('child_process');\nfunction run(req) {\n  exec(`convert ${req.query.file} out.png`);\n}\n", "javascript"),
    );
    renderApp(<CryptWorkspace />);
    await user.click(await screen.findByRole("button", { name: /Face the Possessor on line 3/ }));
    expect(screen.getByText("No safe automatic fix")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Banish" })).not.toBeInTheDocument();
    await user.keyboard("b");
    expect(await screen.findByText("No automatic fix for this one")).toBeInTheDocument();
    // The code is untouched, and it can be dismissed with a reason.
    expect(document.getElementById("code-line-3")).toHaveTextContent("exec(`convert ${req.query.file} out.png`);");
    await user.click(screen.getByRole("button", { name: /^Dismiss…/ }));
    await user.click(within(screen.getByRole("group", { name: "Why are you dismissing it?" })).getByRole("button", { name: /Fixed outside the app/ }));
    expect(screen.getByRole("button", { name: "Bring back the ignored Possessor" })).toHaveTextContent("fixed outside the app");
  });

  it("verifies each fix with a re-scan and shows it in the graveyard", async () => {
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "Possessor" });
    await user.click(screen.getByRole("button", { name: "Banish" }));
    expect(await screen.findByText(/a re-scan no longer finds it/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /GRAVEYARD/ })).getByText("Fixed ✓ re-scan clean")).toBeInTheDocument();
  });

  it("re-scans the file and reports what changed, undoable", async () => {
    const user = userEvent.setup();
    seedReview(loginOnly());
    renderApp(<CryptWorkspace />);
    await screen.findByRole("heading", { name: "Possessor" });
    await user.click(screen.getByRole("button", { name: /Re-scan file/ }));
    expect(await screen.findByText("Re-scanned")).toBeInTheDocument();
    expect(screen.getByText(/0 resolved · 0 new · 6 open in cursed-login\.js/)).toBeInTheDocument();
  });
});
