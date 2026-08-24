import { expect, test } from "@playwright/test";

/**
 * The dictionary surfaces.
 *
 * The entry page renders on the server and calls the provider chain directly
 * rather than over HTTP, so it cannot be intercepted from the browser. The
 * merge behaviour behind it is covered by unit tests instead, and the one spec
 * here that needs a real entry is tagged live and excluded from the default
 * run. Everything else on this page is client side and needs no network.
 */

test.describe("search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dictionary");
  });

  test("goes to the entry for the word and language chosen", async ({ page }) => {
    await page.getByLabel("Word").fill("serendipity");
    await page.getByRole("button", { name: "Look up" }).click();

    await expect(page).toHaveURL(/\/dictionary\/en\/serendipity$/);
  });

  test("submits on enter, without reaching for the button", async ({ page }) => {
    await page.getByLabel("Word").fill("saudade");
    await page.getByLabel("Word").press("Enter");

    await expect(page).toHaveURL(/\/dictionary\/en\/saudade$/);
  });

  test("will not search for nothing", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  test("flips the input to right to left when the language is", async ({ page }) => {
    const word = page.getByLabel("Word");
    await expect(word).toHaveAttribute("dir", "ltr");

    await page.locator(".wk-combo__trigger").click();
    const filter = page.getByRole("combobox", { name: /Language, filter languages/ });
    await filter.pressSequentially("urdu");
    await filter.press("Enter");

    await expect(word).toHaveAttribute("dir", "rtl");
    await expect(word).toHaveAttribute("lang", "ur");
  });

  test("percent encodes a non Latin word into the URL", async ({ page }) => {
    await page.getByRole("button", { name: "猫", exact: true }).click();
    await expect(page).toHaveURL(/\/dictionary\/ja\/%E7%8C%AB$/);
  });

  test("carries the suggestion's own language, not the one in the picker", async ({ page }) => {
    await page.getByRole("button", { name: "کتاب", exact: true }).click();
    await expect(page).toHaveURL(/\/dictionary\/ur\//);
  });
});

test.describe("the languages specimen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/languages");
  });

  test("lists every language in the registry", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Languages" })).toBeVisible();
    await expect(page.locator(".slug")).toHaveCount(107);
  });

  test("is honest about coverage rather than implying it is uniform", async ({ page }) => {
    await expect(page.getByText(/Coverage is not uniform/)).toBeVisible();
    await expect(page.getByText(/no free API exposes them/)).toBeVisible();
  });

  test("shows each language named in its own script and marked with its own lang", async ({ page }) => {
    const japanese = page.locator(".slug").filter({ hasText: "日本語" }).first();
    await expect(japanese.locator(".slug__native")).toHaveAttribute("lang", "ja");

    const urdu = page.locator(".slug").filter({ hasText: "اردو" }).first();
    await expect(urdu.locator(".slug__native")).toHaveAttribute("dir", "rtl");
  });

  test("prints the dialect register with the rules behind each entry", async ({ page }) => {
    const row = page.getByRole("row").filter({ hasText: "Punjabi in Shahmukhi" });

    await expect(row).toContainText("pa-Arab");
    await expect(row).toContainText("script conversion");
  });

  test("counts words and spelling rules separately for a dialect that has both", async ({ page }) => {
    await expect(page.getByRole("row").filter({ hasText: "American English" })).toContainText("spelling rules");
    await expect(page.getByRole("row").filter({ hasText: "Mexican Spanish" })).toContainText("words");
  });

  test("a language card leads to its dictionary", async ({ page }) => {
    await page.locator(".slug").filter({ hasText: "日本語" }).first().click();
    await expect(page).toHaveURL(/\/dictionary\/ja$/);
  });
});

test.describe("a language landing page", () => {
  test("names the language in its own script and lists its dialects", async ({ page }) => {
    await page.goto("/dictionary/pa");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ਪੰਜਾਬੀ");
    await expect(page.getByText(/Punjabi in Gurmukhi, Punjabi in Shahmukhi/)).toBeVisible();
  });

  test("returns a not found page for a language that does not exist", async ({ page }) => {
    const response = await page.goto("/dictionary/zzz");
    expect(response?.status()).toBe(404);
  });
});

/**
 * The one spec that needs a real upstream. Excluded from the default run, so
 * "npm run e2e" never depends on a free provider being up or spends its quota.
 * Run it with: npm run e2e:live
 */
test.describe("a real entry @live", () => {
  test("renders senses, pronunciation and the licence attribution @live", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity");

    await expect(page.locator(".headword__word")).toHaveText("serendipity");
    await expect(page.locator(".sense")).not.toHaveCount(0);
    await expect(page.locator(".ipa").first()).toBeVisible();

    // Wiktionary is CC BY-SA, so the credit is a licence obligation.
    await expect(page.locator(".stamp")).toContainText("CC BY-SA");
  });
});
