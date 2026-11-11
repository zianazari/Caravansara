import { expect, test } from "@playwright/test";
import { WEB } from "./helpers";

/**
 * City search in Persian (feature 028), in a real Chrome on the running stack: the API knows English names
 * only, so the site matches Persian typing against its Persian city names and asks the API by English name.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test("a city typed in Persian, even on an Arabic keyboard, opens its search", async ({ page }) => {
  await page.goto(`${WEB}/fa`);
  const where = page.getByRole("search").getByRole("combobox", { name: "کجا" });
  await where.fill("امستر"); // without the madda
  await page.getByRole("option", { name: /آمستردام/ }).click();
  await expect(where).toHaveValue("آمستردام");
  await page.getByRole("search").getByRole("button", { name: "جستجو" }).click();
  await page.waitForURL(/\/fa\/search\?.*city_id=\d+/);

  await page.goto(`${WEB}/en`);
  const field = page.getByRole("search").getByRole("combobox", { name: "Where" });
  await field.fill("شيراز"); // Arabic yeh, on the English site
  await expect(page.getByRole("option", { name: /Shiraz/ })).toBeVisible();
  await field.fill("قزوین");
  await expect(page.getByText("No city with this name.")).toBeVisible();
});
