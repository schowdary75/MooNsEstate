import { expect, test } from "@playwright/test"

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for the isolated test user")

test("sign-in, protected module, create dialog, and logout", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email address", { exact: true }).fill(email!)
  await page.getByLabel("Password", { exact: true }).fill(password!)
  await page.getByRole("button", { name: "Enter workspace" }).click()

  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Analytics charts" })).toBeVisible()
  await expect(page.getByLabel("Six month lead and opportunity trend")).toBeVisible()
  await expect(page.getByLabel("Opportunity pipeline by stage")).toBeVisible()
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true })
    await expect(dashboardLink).toBeVisible()
    await expect(dashboardLink).toHaveCSS("color", "rgb(255, 255, 255)")
    await expect(dashboardLink).toHaveCSS("background-color", "rgb(0, 0, 0)")
    await expect(page.getByRole("link", { name: "Leads", exact: true })).toBeVisible()
  }

  await page.goto("/leads", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Leads", exact: true, level: 2 })).toBeVisible()
  await page.getByRole("button", { name: "Add Lead" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("heading", { name: "New Lead" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.goto("/pipeline", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Deal pipeline", exact: true, level: 2 })).toBeVisible()
  await expect(page.getByTestId("pipeline-column-Prospecting")).toBeVisible()
  await expect(page.getByTestId("pipeline-column-Closed Won")).toBeVisible()

  await page.goto("/reports", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Reports & analytics", exact: true })).toBeVisible()

  await page.goto("/calendar", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Calendar", exact: true, level: 2 })).toBeVisible()

  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL("/sign-in")
})

test("legacy URLs redirect to their canonical routes", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email address", { exact: true }).fill(email!)
  await page.getByLabel("Password", { exact: true }).fill(password!)
  await page.getByRole("button", { name: "Enter workspace" }).click()
  await expect(page).toHaveURL("/")

  await page.goto("/metting", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL("/meetings")
})
