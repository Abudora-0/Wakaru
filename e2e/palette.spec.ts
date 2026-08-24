import { expect, test } from "@playwright/test";

/**
 * The command palette is a modal dialog, so the interesting assertions are not
 * that it opens, but that it behaves like a dialog: it takes focus, it traps
 * it, and it gives it back to whatever opened it.
 */

test.describe("command palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens on the keyboard shortcut and takes focus", async ({ page }) => {
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeHidden();

    await page.keyboard.press("Control+k");

    await expect(palette).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search commands" })).toBeFocused();
  });

  test("opens from the masthead button for anyone not using the shortcut", async ({ page }) => {
    await page.getByRole("button", { name: "Open the command palette" }).click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  test("the same shortcut closes it again", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("escape closes it and returns focus to the trigger", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Open the command palette" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    // A modal owes the keyboard user their place back.
    await expect(trigger).toBeFocused();
  });

  test("clicking the backdrop closes it, clicking the panel does not", async ({ page }) => {
    await page.keyboard.press("Control+k");

    // The header is the only inert part of the panel: a click in the list
    // would land on an option and run it.
    await page.locator(".palette__head").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByTestId("palette-scrim").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("arrow keys move the active option and report it to assistive tech", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: "Search commands" });

    const first = await input.getAttribute("aria-activedescendant");
    expect(first).toBe("palette-nav-translate");

    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-nav-dictionary");

    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-nav-translate");
  });

  test("arrowing up from the top wraps to the bottom", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: "Search commands" });

    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-theme-system");
  });

  test("navigates with the keyboard alone, no mouse involved", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("read");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/read$/);
    await expect(page.getByRole("heading", { level: 1, name: "Read" })).toBeVisible();
    // Running an action closes the palette.
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("finds a language by its English name and jumps to it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("urdu");

    await expect(page.getByRole("option", { name: /اردو/ })).toBeVisible();
    await page.getByRole("option", { name: /اردو/ }).click();

    await expect(page).toHaveURL(/\/dictionary\/ur$/);
  });

  test("offers to define whatever was typed, ahead of everything else", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("serendipity");

    const input = page.getByRole("combobox", { name: "Search commands" });
    // A free text query is almost always a word, so that offer is first.
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-lookup");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dictionary\/en\/serendipity$/);
  });

  test("switches the theme and keeps it after a reload", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("night ink");
    await page.keyboard.press("Enter");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("always offers to define the text, even when no command matches", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("zzzzzzzz");

    // The list is never empty: text that names no command is treated as a
    // word someone wants defined, which is the far more common intent.
    const input = page.getByRole("combobox", { name: "Search commands" });
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-lookup");
    await expect(page.getByRole("option", { name: 'Look up "zzzzzzzz"' })).toBeVisible();
  });

  test("a command named in the query outranks the offer to define it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("read");

    // Typing "read" means the reader, not the English word "read".
    const input = page.getByRole("combobox", { name: "Search commands" });
    await expect(input).toHaveAttribute("aria-activedescendant", "palette-nav-read");
  });

  test("tab does not escape the dialog", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: "Search commands" });

    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
