import { expect, test } from "@playwright/test";
import { WEB } from "./helpers";

/**
 * Popular cities (feature 030), in a real Chrome on the running stack: an empty city field suggests the most
 * booked cities, and the Persian site puts Iran's cities first.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test("an empty city field suggests popular cities, Iran's first on the Persian site", async ({ page }) => {
  await page.goto(`${WEB}/fa`);
  const where = page.getByRole("search").getByRole("combobox", { name: "کجا" });
  await where.click();
  const list = page.getByRole("listbox", { name: "مقصدهای پرطرفدار" });
  const options = list.getByRole("option");
  await expect(options).toHaveCount(6);
  for (const index of [0, 1, 2]) await expect(options.nth(index)).toContainText("ایران");
  await expect(options.nth(3)).not.toContainText("ایران");
  const name = (await options.nth(3).locator("span").first().textContent()) ?? "";
  await options.nth(3).click();
  await expect(where).toHaveValue(name);

  await page.goto(`${WEB}/en`);
  const field = page.getByRole("search").getByRole("combobox", { name: "Where" });
  await field.click();
  await expect(page.getByRole("listbox", { name: "Popular destinations" }).getByRole("option")).toHaveCount(6);
  await field.fill("Lon");
  await expect(page.getByRole("option", { name: /London/ })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Popular destinations" })).toBeHidden();
});
