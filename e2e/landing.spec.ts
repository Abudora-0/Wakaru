import { expect, test } from "@playwright/test";

/**
 * The front page and the colophon.
 *
 * The point of having a landing page at all is that arriving in a tool tells
 * a first time reader nothing, so these specs check that the page actually
 * explains the three things the site does, and that it is honest about the
 * limits rather than only selling.
 */

test.describe("the landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("does not drop the reader straight into the translator", async ({ page }) => {
    await expect(page.locator(".spread")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand");
  });

  test("leads to the translator and the reader from the cover", async ({ page }) => {
    const cover = page.locator(".cover");
    await cover.getByRole("link", { name: "Start translating" }).click();
    await expect(page).toHaveURL(/\/translate$/);
    await expect(page.locator(".spread")).toBeVisible();

    await page.goBack();
    // Scoped to the cover: the third strip is headed "Read a raw page" too,
    // and is itself a link to the same place.
    await cover.getByRole("link", { name: "Read a raw page" }).click();
    await expect(page).toHaveURL(/\/read$/);
  });

  test("counts languages and dialects from the registry, not from prose", async ({ page }) => {
    const figures = await page.locator(".stat__figure").allTextContents();
    expect(figures).toContain("107");
    expect(figures).toContain("31");
  });

  test("shows a worked dialect example rather than describing the feature", async ({ page }) => {
    const strip = page.locator(".strip").first();
    await expect(strip.locator("mark")).toHaveText("carro");
    await expect(strip).toContainText("auto is Rioplatense");
  });

  test("marks the language of every sample it shows", async ({ page }) => {
    await expect(page.locator('.demo__value[lang="ur"]')).toHaveAttribute("dir", "rtl");
    await expect(page.locator('.demo__value[lang="ko"]')).toBeVisible();
  });

  test("says what the project cannot do, not only what it can", async ({ page }) => {
    const plainly = page.locator(".plainly");
    await expect(plainly).toContainText("What it cannot do");
    await expect(plainly).toContainText("No free API exposes dialects");
  });

  test("each strip is a link to the thing it describes", async ({ page }) => {
    const strips = page.locator(".strip");
    await expect(strips).toHaveCount(3);
    await expect(strips.nth(1)).toHaveAttribute("href", "/dictionary");
    await expect(strips.nth(2)).toHaveAttribute("href", "/read");
  });
});

test.describe("the colophon", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("credits every source with its licence", async ({ page }) => {
    const sources = page.locator(".colophon").getByRole("region", { name: "Sources" })
      .or(page.locator(".column").filter({ hasText: "Sources" }));

    await expect(sources.first()).toContainText("Wiktionary");
    // CC BY-SA is a licence obligation, not a courtesy, so it has to be there.
    await expect(sources.first()).toContainText("CC BY-SA 4.0");
    await expect(sources.first()).toContainText("Datamuse");
  });

  test("carries a real colophon naming what the site is set in", async ({ page }) => {
    await expect(page.locator(".colophon__setin")).toContainText("Zen Antique");
    await expect(page.locator(".colophon__setin")).toContainText("Gentium Plus");
  });

  test("links to the source and the licence", async ({ page }) => {
    const colophon = page.locator(".colophon");
    await expect(colophon.getByRole("link", { name: "Source on GitHub" })).toBeVisible();
    await expect(colophon.getByRole("link", { name: "MIT licence" })).toBeVisible();
  });

  test("appears on every page, not just the front one", async ({ page }) => {
    for (const path of ["/translate", "/dictionary", "/read", "/languages"]) {
      await page.goto(path);
      await expect(page.locator(".colophon")).toBeVisible();
    }
  });
});

test.describe("scrollbars", () => {
  test("have no stepper arrowheads", async ({ page }) => {
    await page.goto("/languages");

    // The buttons at the ends of a scrollbar are operating system chrome that
    // cannot be themed, so they are hidden rather than left mismatched.
    const display = await page.evaluate(() => {
      const probe = document.createElement("style");
      probe.textContent = "";
      document.head.append(probe);
      const sheet = [...document.styleSheets]
        .flatMap((s) => {
          try {
            return [...s.cssRules];
          } catch {
            return [];
          }
        })
        .filter((rule) => rule.cssText.includes("scrollbar-button"));
      return sheet.map((rule) => rule.cssText).join(" ");
    });

    expect(display).toContain("scrollbar-button");
    expect(display).toContain("display: none");
  });
});
