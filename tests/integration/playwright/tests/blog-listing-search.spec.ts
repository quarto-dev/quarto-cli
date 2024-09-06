import { expect, test } from "@playwright/test";

import { getUrl } from "../src/utils.js";

test('List.js is correctly patch to allow searching with lowercase and uppercase', 
  async ({ page }) => {
    await page.goto(getUrl('blog/listing-search/_site/'));
    await page.getByPlaceholder('Filter').click();
    await page.getByPlaceholder('Filter').fill('Code');
    await page.getByPlaceholder('Filter').press('Enter');
    await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeHidden();
    await page.getByPlaceholder('Filter').click();
    await page.getByPlaceholder('Filter').fill('');
    await page.getByPlaceholder('Filter').press('Enter');
    await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeVisible();
    await page.getByPlaceholder('Filter').click();
    await page.getByPlaceholder('Filter').fill('CODE');
    await page.getByPlaceholder('Filter').press('Enter');
    await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeHidden();
});
