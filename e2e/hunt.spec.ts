import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Mocks the signed-in repo picker: one repository, with the given open pull requests. */
async function mockPicker(page: import("@playwright/test").Page, pulls: unknown[] = []) {
  await page.route("**/api/github/repos", (r) =>
    r.fulfill({
      json: {
        repos: [
          {
            owner: "acme",
            name: "shop",
            fullName: "acme/shop",
            private: false,
            language: "JavaScript",
            pushedAt: new Date().toISOString(),
            defaultBranch: "main",
            url: "https://github.com/acme/shop",
            description: null,
            archived: false,
          },
        ],
        installations: [{ account: "acme", selection: "selected", manageUrl: "https://github.com/settings/installations/1" }],
      },
    }),
  );
  await page.route("**/api/github/pulls?*", (r) => r.fulfill({ json: pulls }));
}

test("home → sample → banish everything → report", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Every bug is a/ })).toBeVisible();
  await page.getByRole("button", { name: /cursed-login\.js/ }).click();
  await expect(page).toHaveURL(/\/crypt$/);
  await expect(page.getByRole("heading", { name: "Possessor" })).toBeVisible();

  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Banish", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "The crypt is clear." })).toBeVisible();
  await expect(page.locator("#code-line-7")).toContainText("process.env.API_KEY");
  await expect(page.getByRole("progressbar", { name: /ROOM LIGHT/ })).toHaveAttribute("aria-valuenow", "100");

  await page.getByRole("link", { name: "Finish review" }).click();
  await expect(page.getByRole("heading", { name: "The crypt still stirs." })).toBeVisible();
  await expect(page.getByTestId("stat-Banished (fixed)")).toHaveText("6");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export report/ }).click();
  expect((await download).suggestedFilename()).toBe("cursed-review-Cursed-samples.md");
  if (!isMobile) await expect(page.getByText("+    'SELECT * FROM users WHERE name = $1', [req.body.name]").first()).toBeAttached();
});

test("keyboard hunting and undo", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard spells are a desktop feature");
  await page.goto("/crypt?sample=leaky-cache");
  await expect(page.getByRole("heading", { name: "Leech" })).toBeVisible();
  await page.keyboard.press("j");
  await expect(page.getByRole("heading", { name: "Twin Ghosts" })).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.locator("#code-line-14")).toHaveText(/with _balance_lock:/);
  await page.keyboard.press("u");
  await expect(page.locator("#code-line-14")).toContainText("balance = get_balance(account)");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard spells" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("PR review: sign in, pick a repo and its PR, post the review", async ({ page }) => {
  const sha = "c".repeat(40);
  const code = "export function last(xs) {\n  return xs[xs.length];\n}\n";
  let signedIn = false;
  await mockPicker(page, [
    {
      number: 7,
      title: "Add last()",
      author: "octo",
      draft: false,
      headRef: "feat/last",
      baseRef: "main",
      updatedAt: new Date().toISOString(),
      url: "https://github.com/acme/shop/pull/7",
    },
  ]);
  let posted: Record<string, unknown> | null = null;
  await page.route("**/api/auth/session", (r) => r.fulfill({ json: { mode: "live", user: signedIn ? { login: "octo", name: "Octo Cat" } : null } }));
  await page.route("**/api/github/scan?*", (r) =>
    r.fulfill({
      json: {
        target: "pr",
        pr: {
          owner: "acme",
          repo: "shop",
          number: 7,
          url: "https://github.com/acme/shop/pull/7",
          title: "Add last()",
          author: "octo",
          baseRef: "main",
          headRef: "feat/last",
          headSha: sha,
          skippedFiles: 2,
          files: [{ path: "src/a/util.js", language: "javascript", code, changedLines: [1, 2, 3], additions: 3, deletions: 0 }],
        },
      },
    }),
  );
  await page.route("**/api/github/review", async (r) => {
    posted = r.request().postDataJSON();
    await r.fulfill({ json: { url: "https://github.com/acme/shop/pull/7#pullrequestreview-1", inline: 1, folded: 0 } });
  });

  await page.goto("/");
  await expect(page.getByText("Sign in to see your repositories, open pull requests, and send fixes back.")).toBeVisible();
  signedIn = true; // as if the user came back from GitHub
  await page.reload();
  await page.getByRole("button", { name: /^shop/ }).click();
  await page
    .getByRole("list", { name: "Open pull requests" })
    .getByRole("button", { name: /Add last\(\)/ })
    .click();
  await expect(page).toHaveURL(/\/crypt$/, { timeout: 10_000 });
  await expect(page.getByText("Add last()")).toBeVisible();
  await expect(page.getByText(/2 changed files not scanned/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Face the Imp on line 2/ })).toBeVisible();

  await page.goto("/report");
  await page.getByRole("button", { name: /Post review to GitHub PR/ }).click();
  const dialog = page.getByRole("dialog", { name: "Post review to GitHub" });
  await dialog.getByRole("button", { name: /^Post / }).click();
  await expect(dialog.getByText("Your review is on the pull request.")).toBeVisible({ timeout: 5000 });
  expect(posted).toMatchObject({ owner: "acme", repo: "shop", number: 7, commitId: sha });
});

test("whole repository: Haunted Map → crypt → create issue", async ({ page }) => {
  const sha = "d".repeat(40);
  const buggy = "const SECRET_TOKEN = 'abcdef123456';\nexport function last(xs) {\n  return xs[xs.length];\n}\n";
  const clean = "export const add = (a, b) => a + b;\n";
  let issue: Record<string, string> | null = null;
  await page.route("**/api/auth/session", (r) => r.fulfill({ json: { mode: "live", user: { login: "octo", name: "Octo Cat" } } }));
  await page.route("**/api/github/scan?*", (r) =>
    r.fulfill({
      json: {
        target: "repo",
        owner: "acme",
        repo: "shop",
        ref: "main",
        sha,
        title: "acme/shop: a haunted shop",
        url: "https://github.com/acme/shop",
        skippedFiles: 1,
        files: [
          { path: "src/math/add.js", language: "javascript", code: clean },
          { path: "src/util/last.js", language: "javascript", code: buggy },
        ],
      },
    }),
  );
  await page.route("**/api/github/issue", async (r) => {
    issue = r.request().postDataJSON();
    await r.fulfill({ json: { url: "https://github.com/acme/shop/issues/3", number: 3 } });
  });

  await mockPicker(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^shop/ }).click();
  await expect(page.getByText("No open pull requests.")).toBeVisible();
  await page.getByRole("button", { name: /Whole repository/ }).click();
  await expect(page).toHaveURL(/\/map$/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "2 monsters roam here." })).toBeVisible();
  await page.getByRole("button", { name: /Enter the crypt: start with last\.js/ }).click();
  await expect(page).toHaveURL(/\/crypt$/);
  await expect(page.getByRole("button", { name: /Face the Gremlin on line 1/ })).toBeVisible();

  await page.goto("/report");
  await page.getByRole("button", { name: "Create GitHub issue" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a GitHub issue" });
  await dialog.getByRole("button", { name: "Create issue" }).click();
  await expect(dialog.getByText("The issue is on GitHub.")).toBeVisible();
  expect(issue).toMatchObject({ owner: "acme", repo: "shop" });
  expect(issue!.body).toContain(`https://github.com/acme/shop/blob/${sha}/src/util/last.js#L1`);
});

test("Banish all, then open a fix pull request", async ({ page }) => {
  const sha = "e".repeat(40);
  const buggy = "const SECRET_TOKEN = 'abcdef123456';\nexport function last(xs) {\n  return xs[xs.length];\n}\n";
  let sent: { files: { path: string; content: string }[]; target: { kind: string; baseBranch: string } } | null = null;
  await page.route("**/api/auth/session", (r) => r.fulfill({ json: { mode: "live", user: { login: "octo", name: "Octo Cat" } } }));
  await page.route("**/api/github/scan?*", (r) =>
    r.fulfill({
      json: {
        target: "file",
        owner: "acme",
        repo: "shop",
        ref: "main",
        sha,
        path: "src/last.js",
        title: "src/last.js",
        url: "https://github.com/acme/shop/blob/main/src/last.js",
        skippedFiles: 0,
        files: [{ path: "src/last.js", language: "javascript", code: buggy }],
      },
    }),
  );
  await page.route("**/api/github/fixes", async (r) => {
    sent = r.request().postDataJSON();
    await r.fulfill({ json: { url: "https://github.com/acme/shop/pull/8", branch: "cursed-fixes/today", commits: 1, skipped: [] } });
  });

  await mockPicker(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^shop/ }).click();
  await page.getByRole("button", { name: /Whole repository/ }).click();
  await expect(page).toHaveURL(/\/crypt$/, { timeout: 10_000 });
  await page.getByRole("button", { name: "Banish all" }).click();
  await page.getByRole("dialog", { name: "Banish all" }).getByRole("button", { name: "Banish 2 monsters" }).click();
  // Every monster gone: the crypt turns to daylight.
  await expect(page.getByRole("heading", { level: 2, name: "Daybreak." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-daybreak", "on");

  await page.goto("/report");
  await page.getByRole("button", { name: "Open a fix PR" }).click();
  const dialog = page.getByRole("dialog", { name: "Open a fix pull request" });
  await dialog.getByRole("button", { name: "Open fix pull request" }).click();
  await expect(dialog.getByText("Your fix pull request is open.")).toBeVisible();
  expect(sent!.target).toMatchObject({ kind: "newBranch", baseBranch: "main" });
  expect(sent!.files[0].content).toContain("process.env.SECRET_TOKEN");
  expect(sent!.files[0].content).toContain("xs[xs.length - 1]");
});

test("without a GitHub App there is no fake sign-in", async ({ page }) => {
  await page.route("**/api/auth/session", (r) => r.fulfill({ json: { mode: "off", user: null } }));
  await page.goto("/");
  await expect(page.getByText("Public repositories. Fetched live from GitHub.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in/ })).toHaveCount(0);
});

test("paste flow validates input and finds monsters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Summon the monsters" }).click();
  await expect(page.getByText("Paste some code first.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Code" })
    .fill("const token = 'ghp_abcdefghijklmnop';\nconst el = document.querySelector('#x');\nel.classList.add('on');\n");
  await page.getByRole("button", { name: "Summon the monsters" }).click();
  await expect(page).toHaveURL(/\/crypt$/);
  await expect(page.getByRole("button", { name: /Face the Gremlin on line 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Face the Void Wraith on line 3/ })).toBeVisible();
});

test("bestiary and 404 render", async ({ page }) => {
  await page.goto("/bestiary");
  await expect(page.getByRole("heading", { name: "The Bestiary" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Twin Ghosts" })).toBeVisible();
  await page.goto("/nowhere");
  await expect(page.getByRole("heading", { name: "This room does not exist." })).toBeVisible();
});

test("no horizontal page scroll", async ({ page }) => {
  for (const path of ["/", "/crypt?sample=haunted-api", "/report", "/map", "/bestiary"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
