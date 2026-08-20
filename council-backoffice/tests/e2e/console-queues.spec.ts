import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/console-test-fixture");
  await expect(page.getByText(/TEST FIXTURE ONLY/)).toBeVisible();
});

test("queue has a keyboard skip path and no automatic axe violations", async ({ page }) => {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to Main Content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#fixture-main")).toBeFocused();

  const results = await new AxeBuilder({ page }).include("#fixture-main").analyze();
  expect(results.violations).toEqual([]);
});

test("operators can filter, save, restore and page a URL-backed view", async ({ page }) => {
  await page.getByLabel("Search generated test records").fill("bank holiday");
  await page.getByLabel("Filter by status").selectOption("ready");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  await expect(page).toHaveURL(/q=bank\+holiday/);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByRole("row", { name: /urgent bank holiday route/i })).toBeVisible();
  await expect(page.getByText("Showing 1–1 of 1 matching record")).toBeVisible();

  await expect(page.getByRole("button", { name: "Restore" })).toBeEnabled();
  await page.getByRole("button", { name: "Save View" }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("what-bin-console:view:console-test-fixture"))).toContain("q=bank+holiday");
  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page).toHaveURL(/\/console-test-fixture$/);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page).toHaveURL(/q=bank\+holiday/);

  await page.getByRole("link", { name: "Reset" }).click();
  const pagination = page.getByRole("navigation", { name: "Generated Test Queue pages" });
  await expect(pagination.getByText("Page 1 of 3")).toBeVisible();
  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
});

test("record drawers restore focus and the mobile table exposes responsive labels", async ({ page }, testInfo) => {
  const trigger = page.getByRole("button", { name: "Open Test Drawer" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create Test Fixture Record" });
  await expect(dialog).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(viewport).not.toBeNull();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - (viewport?.width ?? 0))).toBeLessThanOrEqual(1);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  if (testInfo.project.name === "mobile-chromium") {
    const responsiveLabel = await page.locator("tbody td").first().evaluate((cell) => getComputedStyle(cell, "::before").content);
    expect(responsiveLabel).toContain("Record");
  }
});
