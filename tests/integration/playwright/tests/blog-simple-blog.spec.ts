import { expect, test } from "@playwright/test";
import { getUrl } from "../src/utils";

const testPages = {
  'posts': 'table.html',
  'posts2': 'default.html',
  'posts3': 'grid.html'
};

Object.entries(testPages).forEach(([postDir, pageName]) => {
  test(`List.js is correctly patched to allow searching with lowercase and uppercase on ${pageName}`, 
    async ({ page }) => {
      await page.goto(`./blog/simple-blog/_site/${pageName}`);
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

  test(`All Categories links are clickable ${postDir} pages`, 
    async ({ page }) => {
      const checkCategoryLink = async (category: string, pageName: string) => {
        await page.getByRole('link', { name: category }).click();
        await expect(page).toHaveURL(getUrl(`blog/simple-blog/_site/${pageName}#category=${encodeURIComponent(category)}`));
        await expect(page.locator(`div.category[data-category="${btoa(encodeURIComponent(category))}"]`)).toHaveClass(/active/);
      };
      // Checking link is working
      await page.goto(`./blog/simple-blog/_site/${postDir}/welcome/`);
      await checkCategoryLink('news', pageName);
      // Including for special characters
      await page.getByRole('link', { name: 'Welcome To My Blog' }).click();
      await checkCategoryLink('euros (€)', pageName);
      await page.getByRole('link', { name: 'Welcome To My Blog' }).click();
      await checkCategoryLink('免疫', pageName);
      await page.goto(`./blog/simple-blog/_site/${postDir}/post-with-code/`);
      await checkCategoryLink("apos'trophe", pageName);
      // special check for when a page is not loaded from non root path
      await page.goto(`./blog/simple-blog/_site/${postDir}/welcome/#img-lst`);
      await checkCategoryLink('news', pageName);
  });
});
