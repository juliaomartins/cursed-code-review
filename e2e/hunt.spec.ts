import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

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

test("PR review: private repo needs sign-in, then post the review", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Pull request link").fill("https://github.com/acme/private-vault/pull/7");
  await page.getByRole("button", { name: "Open the PR in the crypt" }).click();
  await expect(page.getByText("This repository is private.")).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Open the PR in the crypt" }).click();
  await expect(page).toHaveURL(/\/crypt$/, { timeout: 10_000 });
  await expect(page.getByText("PULL REQUEST")).toBeVisible();

  await page.goto("/report");
  await page.getByRole("button", { name: /Post review to GitHub PR/ }).click();
  const dialog = page.getByRole("dialog", { name: "Post review to GitHub" });
  await dialog.getByRole("button", { name: /^Post / }).click();
  await expect(dialog.getByText("Your review is on the pull request.")).toBeVisible({ timeout: 5000 });
});

test("paste flow validates input and finds monsters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Summon the monsters" }).click();
  await expect(page.getByText("Paste some code first.")).toBeVisible();
  await page.getByRole("textbox", { name: "Code" }).fill("const token = 'ghp_abcdefghijklmnop';\nconst el = document.querySelector('#x');\nel.classList.add('on');\n");
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
  for (const path of ["/", "/crypt?sample=haunted-api", "/report", "/bestiary"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
