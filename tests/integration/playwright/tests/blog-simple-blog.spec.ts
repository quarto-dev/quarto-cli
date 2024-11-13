import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

test('List.js is correctly patch to allow searching with lowercase and uppercase', 
  async ({ page }) => {
    await page.goto('./blog/simple-blog/_site/');
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

test('Categories link are clickable', async ({ page }) => {
  await page.goto('./blog/simple-blog/_site/posts/welcome/');
  await page.locator('div').filter({ hasText: /^news$/ }).click();
  await expect(page).toHaveURL(/_site\/index\.html#category=news$/);
  await expect(page.locator(`div.category[data-category="${btoa('news')}"]`)).toHaveClass(/active/);
  await page.goto('./blog/simple-blog/_site/posts/welcome/#img-lst');
  await page.locator('div').filter({ hasText: /^news$/ }).click();
  await expect(page).toHaveURL(/_site\/index\.html#category=news$/);
  await expect(page.locator(`div.category[data-category="${btoa('news')}"]`)).toHaveClass(/active/);
});

test('Categories link with special chars are clickable', async ({ page }) => {
  await page.goto('./blog/simple-blog/_site/posts/welcome/');
  await page.getByRole('link', { name: 'news' }).click();
  await expect(page).toHaveURL(/_site\/index\.html#category=news$/);
  await expect(page.locator(`div.category[data-category="${btoa('news')}"]`)).toHaveClass(/active/);
  await page.getByRole('link', { name: 'Welcome To My Blog' }).click(); 
  await page.getByRole('link', { name: 'euros (€)' }).click();
  await expect(page).toHaveURL(getUrl(`blog/simple-blog/_site/index.html#category=${encodeURIComponent('euros (€)')}`));
  await expect(page.locator(`div.category[data-category="${btoa(encodeURIComponent('euros (€)'))}"]`)).toHaveClass(/active/);
  await page.getByRole('link', { name: 'Welcome To My Blog' }).click(); 
  await page.getByRole('link', { name: '免疫' }).click();
  await expect(page).toHaveURL(getUrl(`blog/simple-blog/_site/index.html#category=${encodeURIComponent('免疫')}`));
  await expect(page.locator(`div.category[data-category="${btoa(encodeURIComponent('免疫'))}"]`)).toHaveClass(/active/);
  await page.goto('./blog/simple-blog/_site/posts/welcome/#img-lst');
  await page.locator('div').filter({ hasText: /^news$/ }).click();
  await expect(page).toHaveURL(/_site\/index\.html#category=news$/);
  await expect(page.locator(`div.category[data-category="${btoa('news')}"]`)).toHaveClass(/active/);
});