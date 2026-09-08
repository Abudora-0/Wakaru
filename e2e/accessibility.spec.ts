import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * An automated accessibility pass.
 *
 * axe-core catches maybe a third of real accessibility problems, the
 * mechanical third: missing labels, bad contrast, wrong ARIA. It cannot tell
 * you whether the combobox is actually usable with a screen reader, which is
 * why the translate and palette specs elsewhere drive real keyboard paths.
 * This is the floor, not the whole of it, and it is worth having as a floor
 * because the custom controls here have no native semantics to fall back on.
 *
 * WCAG 2.1 AA is the standard checked. Best practice rules are excluded:
 * those are opinions axe holds about good design, not accessibility failures,
 * and mixing them in would make a passing run indistinguishable from a
 * failing one in the output.
 */

const PAGES = ["/", "/translate", "/dictionary", "/languages", "/read"] as const;

for (const path of PAGES) {
  test(`${path} has no automatically detectable violations, light`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test(`${path} has no automatically detectable violations, dark`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("a dictionary entry has no violations", async ({ page }) => {
  await page.goto("/dictionary/en/serendipity");
  await page.waitForLoadState("networkidle");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("the command palette has no violations while open", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.waitForSelector('[role="dialog"]');

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("the language combobox has no violations while open", async ({ page }) => {
  await page.goto("/translate");
  await page.locator(".wk-combo__trigger").first().click();
  await page.waitForSelector(".wk-listbox");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
