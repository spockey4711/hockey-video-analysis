import { expect, test } from "@playwright/test";

/**
 * Smoke test: the home page compiles and renders.
 *
 * This guards against build-time regressions that let the server start but
 * serve a 500 - e.g. a malformed stylesheet that fails CSS parsing. Keep it
 * assertion-light; deeper flows belong in their own specs.
 */
test("home page renders its hero heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tag the game. Share the clips.",
    }),
  ).toBeVisible();
});
