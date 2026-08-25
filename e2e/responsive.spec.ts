import { expect, test } from "@playwright/test";

/**
 * The narrow layout.
 *
 * The book spread only works while there are two pages side by side, so below
 * 900px it folds into stacked panels and the spine turns from a vertical
 * gutter into a horizontal rule. That is a real layout change rather than a
 * reflow, which makes it worth its own spec.
 *
 * Runs under the mobile project only.
 */

test.describe("on a phone", () => {
  test("folds the spread into stacked panels", async ({ page }) => {
    await page.goto("/translate");

    const columns = await page.locator(".spread").evaluate((node) => getComputedStyle(node).gridTemplateColumns);

    // One column, not three.
    expect(columns.split(" ")).toHaveLength(1);
  });

  test("keeps the seal reachable between the two panels", async ({ page }) => {
    await page.goto("/translate");

    const seal = page.locator(".gutter").getByRole("button", { name: "Translate" });
    await expect(seal).toBeVisible();

    const gutter = await page.locator(".gutter").evaluate((node) => getComputedStyle(node).flexDirection);
    // The spine runs across the page rather than down it.
    expect(gutter).toBe("row");
  });

  test("drops the masthead tagline rather than crowding the brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".masthead__tagline")).toBeHidden();
  });

  test("the command palette still opens and fills the width", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open the command palette" }).click();

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();

    const box = await palette.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  });

  test("the language list is usable by touch", async ({ page }) => {
    await page.goto("/translate");

    await page.locator(".wk-combo__trigger").nth(1).tap();
    await expect(page.locator(".wk-listbox")).toBeVisible();

    await page.getByRole("option", { name: /اردو/ }).tap();
    await expect(page.locator(".rendered")).toHaveAttribute("dir", "rtl");
  });

  test("nothing forces the page to scroll sideways", async ({ page }) => {
    for (const path of ["/", "/dictionary", "/languages", "/read"]) {
      await page.goto(path);

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, `${path} scrolls horizontally`).toBe(false);
    }
  });
});
