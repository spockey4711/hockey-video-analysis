import { expect, test } from "@playwright/test";

import { E2E_COACH, E2E_GAME } from "./coach-flow-fixture";

const LIVE_CLIP_STATUSES = ["pending", "processing", "ready"] as const;

/**
 * Critical coach path: sign in, open a seeded game, capture one tag, and see
 * `POST /api/clips` enqueue a cut. The chapter row is metadata only; this spec
 * does not cut with ffmpeg and does not need Drive or the Mac app.
 */
test("coach logs in, tags a game and enqueues a clip", async ({ page }) => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for the coach-flow spec; the test is not skipped",
    );
  }

  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(E2E_COACH.email);
  await page.getByLabel("Passwort").fill(E2E_COACH.password);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(
    page.getByText(`Willkommen zurück, ${E2E_COACH.name}.`),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: "Spiele" })
    .click();
  await expect(page).toHaveURL(/\/games$/);
  await page.getByRole("link", { name: new RegExp(E2E_GAME.title) }).click();

  await expect(page).toHaveURL(/\/games\/[0-9a-f-]+\/watch$/i);
  await expect(
    page.getByRole("heading", { level: 1, name: E2E_GAME.title }),
  ).toBeVisible();

  await page.getByTitle("Tor (T)").click();
  const tagRow = page.getByRole("button", { name: /Tor bei 0:00 auswählen/ });
  await expect(tagRow).toBeVisible();

  const enqueueResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/clips") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "1 Clips schneiden" }).click();
  const response = await enqueueResponse;
  const body: unknown = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).not.toBe(401);
  expect(response.status(), JSON.stringify(body)).toBeLessThan(500);
  expect([200, 201]).toContain(response.status());
  expect(body).toEqual(
    expect.objectContaining({
      clip: expect.objectContaining({
        status: expect.stringMatching(/^(pending|processing|ready)$/),
      }),
    }),
  );
  const status = (body as { clip: { status: string } }).clip.status;
  expect(LIVE_CLIP_STATUSES).toContain(status);

  await tagRow.click();
  await expect(page.getByText("In Warteschlange")).toBeVisible();
});
