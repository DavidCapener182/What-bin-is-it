import { expect, test, type Locator, type Page } from "@playwright/test";

const fixtureEmail = "operator@council-e2e.test";

async function loginToGeneratedCouncil(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your council workspace" })).toBeVisible();
  await expect(page.getByLabel("Generated test operator email")).toHaveValue(fixtureEmail);
  await page.getByRole("button", { name: "Open generated test workspace" }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.getByRole("heading", { level: 1, name: "Announcements" })).toBeVisible();
}

function desktopOnly(projectName: string) {
  test.skip(projectName !== "desktop-chromium", "Functional mutations run once; responsive views have separate visual coverage.");
}

function rowStatus(row: Locator) {
  return row.locator(':scope > td[data-label="Status"] .status-pill');
}

test("actual console routes preserve the login and access boundary", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/announcements");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Authorised staff only")).toBeVisible();

  await loginToGeneratedCouncil(page);
  await expect(page.getByRole("complementary").getByText("Generated E2E Council", { exact: true })).toBeVisible();
  await expect(page.locator(".role-pill")).toContainText("owner");
});

test("fixture routes reject a non-loopback host even when the development gate is on", async ({ request }, testInfo) => {
  desktopOnly(testInfo.project.name);
  const response = await request.get("/console-test-fixture", {
    headers: { "x-forwarded-host": "console.example.gov.uk" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("announcement journey saves a draft and requires council confirmation before publishing", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await loginToGeneratedCouncil(page);

  await page.getByRole("button", { name: "Create Announcement" }).click();
  let dialog = page.getByRole("dialog", { name: "Create Announcement" });
  await dialog.getByLabel("Resident-facing title").fill("Generated resident service update");
  await dialog.getByRole("textbox", { name: "Message", exact: true }).fill("Generated test collections will resume tomorrow morning.");
  await dialog.getByRole("button", { name: "Save Draft" }).click();

  await expect(page.getByRole("status")).toContainText("Announcement saved.");
  let row = page.getByRole("row").filter({ hasText: "Generated resident service update" });
  await expect(rowStatus(row)).toHaveText("draft");

  await row.getByRole("button", { name: "Review" }).click();
  dialog = page.getByRole("dialog", { name: "Generated resident service update" });
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator(".feedback-error")).toContainText("Confirm the selected council and action before continuing.");
  row = page.getByRole("row").filter({ hasText: "Generated resident service update" });
  await expect(rowStatus(row)).toHaveText("draft");

  await row.getByRole("button", { name: "Review" }).click();
  dialog = page.getByRole("dialog", { name: "Generated resident service update" });
  await dialog.getByRole("checkbox", { name: /Publish for Generated E2E Council/ }).check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Announcement status updated.");
  row = page.getByRole("row").filter({ hasText: "Generated resident service update" });
  await expect(rowStatus(row)).toHaveText("published");
});

test("disruption journey moves through draft, published and resolved states", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await loginToGeneratedCouncil(page);
  await page.goto("/disruptions");

  await page.getByRole("button", { name: "Record Disruption" }).click();
  let dialog = page.getByRole("dialog", { name: "Record Service Disruption" });
  await dialog.getByLabel("Title").fill("Generated recycling round delay");
  await dialog.getByLabel("What happened?").fill("A generated vehicle issue delayed the test round.");
  await dialog.getByLabel("What should residents do?").fill("Leave recycling containers out until tomorrow evening.");
  await dialog.getByLabel("Starts").fill("2026-08-20T07:30");
  await dialog.getByRole("button", { name: "Save Draft" }).click();

  await expect(page.getByRole("status")).toContainText("Service disruption saved.");
  let row = page.getByRole("row").filter({ hasText: "Generated recycling round delay" });
  await expect(rowStatus(row)).toHaveText("draft");

  await row.getByRole("button", { name: "Review" }).click();
  dialog = page.getByRole("dialog", { name: "Generated recycling round delay" });
  await dialog.getByRole("checkbox", { name: /Publish for Generated E2E Council/ }).check();
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Disruption status updated.");
  row = page.getByRole("row").filter({ hasText: "Generated recycling round delay" });
  await expect(rowStatus(row)).toHaveText("published");

  await row.getByRole("button", { name: "Review" }).click();
  dialog = page.getByRole("dialog", { name: "Generated recycling round delay" });
  await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Disruption status updated.");
  row = page.getByRole("row").filter({ hasText: "Generated recycling round delay" });
  await expect(rowStatus(row)).toHaveText("resolved");
});

test("resident support journey sends a resident-visible reply through the actual case action", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await loginToGeneratedCouncil(page);
  await page.goto("/crm/messages");

  await expect(page.getByRole("heading", { level: 1, name: "Support cases" })).toBeVisible();
  await page.getByLabel("Reply in the app").fill("Please leave the recycling container out. The crew will return tomorrow.");
  await page.getByRole("button", { name: "Send reply" }).click();

  await expect(page).toHaveURL(/thread=80000000-0000-4000-8000-000000000008&saved=/);
  await expect(page.getByRole("status")).toContainText("Reply sent in the app.");
  await expect(page.getByText("Please leave the recycling container out. The crew will return tomorrow.")).toBeVisible();
  await expect(page.locator(".resident-conversation .status-pill")).toHaveText("waiting resident");
});

test("partner approval and external booking confirmation use the actual operational actions", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await loginToGeneratedCouncil(page);
  await page.goto("/partners?view=partners&status=review");

  let row = page.getByRole("row").filter({ hasText: "Generated Bulky Waste Partner" });
  await expect(rowStatus(row)).toHaveText("review");
  await row.getByRole("button", { name: "Review" }).click();
  let dialog = page.getByRole("dialog", { name: "Generated Bulky Waste Partner" });
  await dialog.getByRole("checkbox", { name: /Confirm Generated E2E Council/ }).check();
  await dialog.getByRole("button", { name: "Approve & Activate" }).click();
  await expect(page.getByRole("status")).toContainText("Partner status updated.");
  row = page.getByRole("row").filter({ hasText: "Generated Bulky Waste Partner" });
  await expect(rowStatus(row)).toHaveText("active");

  await page.goto("/partners?view=bookings");
  row = page.getByRole("row").filter({ hasText: "WB-E2EBOOKING01" });
  await expect(rowStatus(row)).toHaveText("started");
  await row.getByRole("button", { name: "Review" }).click();
  dialog = page.getByRole("dialog", { name: "Booking WB-E2EBOOKING01" });
  await dialog.getByLabel("Provider confirmation reference").fill("PROVIDER-E2E-001");
  await dialog.getByRole("checkbox", { name: /Confirm for Generated E2E Council/ }).check();
  await dialog.getByRole("button", { name: "Confirm Provider Evidence" }).click();
  await expect(page.getByRole("status")).toContainText("provider-confirmed booking");

  await page.goto("/partners?view=bookings");
  row = page.getByRole("row").filter({ hasText: "WB-E2EBOOKING01" });
  await expect(rowStatus(row)).toHaveText("confirmed");
  await expect(row).toContainText("Provider PROVIDER-E2E-001");
});

test("representative actual operational views match desktop and mobile baselines", async ({ page }) => {
  await loginToGeneratedCouncil(page);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; } * { caret-color: transparent !important; }",
  });
  await expect(page.getByRole("heading", { level: 2, name: "Announcement Queue" })).toBeVisible();
  await expect(page).toHaveScreenshot("actual-announcement-operations.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.025,
    threshold: 0.25,
  });

  await page.goto("/crm/messages");
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; } * { caret-color: transparent !important; }",
  });
  await expect(page.getByRole("heading", { level: 1, name: "Support cases" })).toBeVisible();
  await expect(page).toHaveScreenshot("actual-support-operations.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.025,
    threshold: 0.25,
  });
});
