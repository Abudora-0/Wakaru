import { expect, test } from "@playwright/test";
import { AFTER_FALLBACK, JAPANESE_PLAIN, SHAHMUKHI, SPANISH_MEXICAN, mockTranslate } from "./fixtures";

/**
 * The translator spread.
 *
 * Provider responses are stubbed so these specs test the interface rather than
 * the network. What matters here is the behaviour that is genuinely custom:
 * the rebuilt combobox, the dialect chips, and the ledger that reports what
 * the overlay changed and which provider answered.
 */

const seal = ".gutter";

test.beforeEach(async ({ page }) => {
  await page.goto("/translate");
});

test.describe("translating", () => {
  test("renders the result and stamps the provider that served it", async ({ page }) => {
    await mockTranslate(page, JAPANESE_PLAIN);

    await page.getByLabel("Text to translate").fill("Good morning");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    await expect(page.locator(".rendered")).toHaveText("おはようございます");
    await expect(page.locator(".ledger__stamp")).toHaveText("mymemory");
  });

  test("translates on the keyboard shortcut as well as the seal", async ({ page }) => {
    await mockTranslate(page, JAPANESE_PLAIN);

    const composer = page.getByLabel("Text to translate");
    await composer.fill("Good morning");
    await composer.press("Control+Enter");

    await expect(page.locator(".rendered")).toHaveText("おはようございます");
  });

  test("says which providers failed before one answered", async ({ page }) => {
    await mockTranslate(page, AFTER_FALLBACK);

    await page.getByLabel("Text to translate").fill("Good morning");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    await expect(page.locator(".ledger__stamp")).toHaveText("libretranslate");
    await expect(page.getByText("after mymemory failed")).toBeVisible();
  });

  test("reports a provider error instead of rendering an empty result", async ({ page }) => {
    await mockTranslate(page, { error: "daily character budget exhausted" }, 429);

    await page.getByLabel("Text to translate").fill("Good morning");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    // Scoped to the notice, because the Next route announcer is also an alert.
    await expect(page.locator(".notice[role=alert]")).toContainText("daily character budget exhausted");
    await expect(page.locator(".rendered")).toBeEmpty();
  });

  test("will not translate an empty composer", async ({ page }) => {
    await expect(page.locator(seal).getByRole("button", { name: "Translate" })).toBeDisabled();
  });

  test("counts characters against the request limit", async ({ page }) => {
    await page.getByLabel("Text to translate").fill("hello");
    await expect(page.locator(".counter")).toHaveText("5 / 5000");
  });
});

test.describe("the language combobox", () => {
  test("is operable with the keyboard alone and never a native select", async ({ page }) => {
    // Nothing in this control is a native select, so the whole keyboard
    // contract has to be honoured by hand. This is the test for that.
    await expect(page.locator("select")).toHaveCount(0);

    const target = page.getByRole("button", { name: /Into/ }).or(page.locator("#\:r1\:"));
    const trigger = page.locator(".wk-combo__trigger").nth(1);

    await trigger.press("Enter");
    const filter = page.getByRole("combobox", { name: /Into, filter languages/ });
    await expect(filter).toBeFocused();

    await filter.pressSequentially("urdu");
    await expect(page.getByRole("option")).toHaveCount(1);

    await filter.press("Enter");
    await expect(trigger).toContainText("اردو");
    await expect(target).toBeTruthy();
  });

  test("switches the target pane to right to left for an RTL language", async ({ page }) => {
    const trigger = page.locator(".wk-combo__trigger").nth(1);
    await trigger.click();

    const filter = page.getByRole("combobox", { name: /Into, filter languages/ });
    await filter.pressSequentially("urdu");
    await filter.press("Enter");

    await expect(page.locator(".rendered")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".rendered")).toHaveAttribute("lang", "ur");
  });

  test("shows a sample of each script rather than a flag", async ({ page }) => {
    await page.locator(".wk-combo__trigger").nth(1).click();

    const japanese = page.getByRole("option", { name: /日本語/ });
    await expect(japanese.locator(".wk-option__native")).toHaveText("日");
    // A flag names a country, not a language, so there are none anywhere.
    await expect(page.locator(".wk-listbox")).not.toContainText("🇯🇵");
  });

  test("escape closes the list and leaves the choice alone", async ({ page }) => {
    const trigger = page.locator(".wk-combo__trigger").nth(1);
    const before = await trigger.textContent();

    await trigger.click();
    await expect(page.locator(".wk-listbox")).toBeVisible();

    await page.getByRole("combobox", { name: /Into, filter languages/ }).press("Escape");

    await expect(page.locator(".wk-listbox")).toBeHidden();
    await expect(trigger).toHaveText(before ?? "");
    await expect(trigger).toBeFocused();
  });
});

test.describe("the dialect layer", () => {
  /** Choose a target language through the rebuilt combobox. */
  async function chooseTarget(page: import("@playwright/test").Page, filter: string) {
    await page.locator(".wk-combo__trigger").nth(1).click();
    const search = page.getByRole("combobox", { name: /Into, filter languages/ });
    await search.pressSequentially(filter);
    await search.press("Enter");
  }

  test("offers a chip for every dialect the language has", async ({ page }) => {
    await chooseTarget(page, "spanish");

    await expect(page.getByRole("button", { name: "Standard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mexican Spanish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rioplatense Spanish" })).toBeVisible();
  });

  test("says plainly when a language has no dialect data yet", async ({ page }) => {
    await chooseTarget(page, "finnish");
    await expect(page.getByText("No dialect data for this language yet")).toBeVisible();
  });

  test("sends the chosen dialect to the server", async ({ page }) => {
    const requests = await mockTranslate(page, SPANISH_MEXICAN);

    await chooseTarget(page, "spanish");
    await page.getByRole("button", { name: "Mexican Spanish" }).click();
    await page.getByLabel("Text to translate").fill("I need a computer and a car.");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    await expect(page.locator(".rendered")).toContainText("carro");
    expect(requests[0]).toMatchObject({ to: "es", dialect: "es-MX" });
  });

  test("lists every edit the overlay made, with its reason", async ({ page }) => {
    await mockTranslate(page, SPANISH_MEXICAN);

    await chooseTarget(page, "spanish");
    await page.getByRole("button", { name: "Mexican Spanish" }).click();
    await page.getByLabel("Text to translate").fill("I need a computer and a car.");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    // Nothing is changed invisibly: the ledger is the point of the feature.
    await expect(page.getByRole("heading", { name: "What the dialect layer changed" })).toBeVisible();
    await expect(page.locator(".edits__from")).toHaveText("auto");
    await expect(page.locator(".edits__to")).toHaveText("carro");
    await expect(page.locator(".edits__note")).toContainText("Rioplatense");
  });

  test("marks the rewritten word inside the translation itself", async ({ page }) => {
    await mockTranslate(page, SPANISH_MEXICAN);

    await chooseTarget(page, "spanish");
    await page.getByRole("button", { name: "Mexican Spanish" }).click();
    await page.getByLabel("Text to translate").fill("I need a computer and a car.");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    const mark = page.locator(".rendered mark.edit");
    await expect(mark).toHaveText("carro");
    await expect(mark).toHaveAttribute("title", /was "auto"/);
  });

  test("warns when a script conversion is only an approximation", async ({ page }) => {
    await mockTranslate(page, SHAHMUKHI);

    await chooseTarget(page, "punjabi");
    await page.getByRole("button", { name: "Punjabi in Shahmukhi" }).click();
    await page.getByLabel("Text to translate").fill("love");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();

    await expect(page.getByText("This script conversion is an approximation.")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("short vowels");
  });

  test("clears a stale result when the dialect changes", async ({ page }) => {
    await mockTranslate(page, SPANISH_MEXICAN);

    await chooseTarget(page, "spanish");
    await page.getByLabel("Text to translate").fill("I need a computer.");
    await page.locator(seal).getByRole("button", { name: "Translate" }).click();
    await expect(page.locator(".rendered")).not.toBeEmpty();

    // The old translation is not valid for the new dialect, so it must go
    // rather than sit there looking current.
    await page.getByRole("button", { name: "Mexican Spanish" }).click();
    await expect(page.locator(".rendered")).toBeEmpty();
  });
});
