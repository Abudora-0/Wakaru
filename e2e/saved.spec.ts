import { expect, test } from "@playwright/test";

/**
 * The saved word list.
 *
 * It lives entirely in localStorage, so every spec here gets a fresh, empty
 * list for free from Playwright's per test browser context. The entry page it
 * saves from renders on the server against a real provider, the same
 * tradeoff dictionary.spec.ts already makes for "serendipity", so the timeout
 * is widened the same way rather than mocking a route that does not exist.
 */

const ENTRY_NAV = { timeout: 20_000 };

test.describe("saving a word", () => {
  test("says plainly when nothing is saved yet", async ({ page }) => {
    await page.goto("/saved");
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  });

  test("the Save button adds the entry and Saved page lists it", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity", ENTRY_NAV);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByRole("link", { name: /serendipity/ })).toBeVisible();
    await expect(page.getByText("1 saved")).toBeVisible();
  });

  test("pressing it again removes the word, on the entry page itself", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity", ENTRY_NAV);
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Saved" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  });

  test("the Remove button on the list page takes it off the list", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity", ENTRY_NAV);
    await page.getByRole("button", { name: "Save" }).click();

    await page.goto("/saved");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  });

  test("offers the list back out as a JSON file and a text file", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity", ENTRY_NAV);
    await page.getByRole("button", { name: "Save" }).click();

    await page.goto("/saved");
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export text" })).toBeVisible();
  });

  test("a saved word survives a reload, since it lives in this browser", async ({ page }) => {
    await page.goto("/dictionary/en/serendipity", ENTRY_NAV);
    await page.getByRole("button", { name: "Save" }).click();

    await page.reload();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  });
});
