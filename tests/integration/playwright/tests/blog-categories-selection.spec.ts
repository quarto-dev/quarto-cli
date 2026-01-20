import { expect, Page, test } from "@playwright/test";
import { getUrl } from "../src/utils";

declare const process: { platform: string };

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

  const checkCategoryLink = async (page: Page, category: string, pageName: string, postTitle: string) => {
    await page.getByText(category, { exact: true }).click();
    await expect(page).toHaveURL(getUrl(`blog/simple-blog/_site/${pageName}#category=${encodeURIComponent(category)}`));
    await expect(page.locator(`div.category[data-category="${btoa(encodeURIComponent(category))}"]`)).toHaveClass(/active/);
    await expect(page.getByRole('link', { name: postTitle })).toBeVisible();
  };

  test(`All Categories links are clickable ${postDir} pages`, 
    async ({ page }) => {
      // Checking link is working
      await page.goto(`./blog/simple-blog/_site/${postDir}/welcome/`);
      await checkCategoryLink(page, 'news', pageName, 'Welcome To My Blog');
      // Including for special characters
      await page.getByRole('link', { name: 'Welcome To My Blog' }).click();
      await checkCategoryLink(page, 'euros (€)', pageName, 'Welcome To My Blog');
      await page.getByRole('link', { name: 'Welcome To My Blog' }).click();
      await checkCategoryLink(page, '免疫', pageName, 'Welcome To My Blog');
      await page.goto(`./blog/simple-blog/_site/${postDir}/post-with-code/`);
      await checkCategoryLink(page, "apos'trophe", pageName, 'Post With Code');
      // special check for when a page is not loaded from non root path
      await page.goto(`./blog/simple-blog/_site/${postDir}/welcome/#img-lst`);
      await checkCategoryLink(page, 'news', pageName, 'Welcome To My Blog');
      // special check for post with space in page name
      await page.goto(`./blog/simple-blog/_site/${postDir}/post with space/`);
      await checkCategoryLink(page, 'news', pageName, 'testing post with space');
  });

  if (pageName !== 'table.html') {
    test(`Categories link on listing page works for ${pageName}`, async ({ page }) => {
      await page.goto(`./blog/simple-blog/_site/${pageName}`);
      await checkCategoryLink(page, 'apos\'trophe', pageName, 'Post With Code');
      await page.goto(`./blog/simple-blog/_site/${pageName}`);
      await checkCategoryLink(page, 'euros (€)', pageName, 'Welcome To My Blog');
      await page.goto(`./blog/simple-blog/_site/${pageName}`);
      await checkCategoryLink(page, '免疫', pageName, 'Welcome To My Blog');
    });

    test(`Multiple category selection with Ctrl+click works for ${pageName}`, async ({ page }) => {
      await page.goto(`./blog/simple-blog/_site/${pageName}`);

      // Target category sidebar specifically (not post card categories)
      const categorySidebar = page.locator('.quarto-listing-category');
      const codeCategory = categorySidebar.locator(`div.category[data-category="${btoa(encodeURIComponent('code'))}"]`);
      const eurosCategory = categorySidebar.locator(`div.category[data-category="${btoa(encodeURIComponent('euros (€)'))}"]`);

      // Click on "code" category (only Post With Code has this category)
      await codeCategory.click();
      await expect(codeCategory).toHaveClass(/active/);
      await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeHidden();

      // Ctrl+click on "euros (€)" category to add it to selection (only Welcome has this category)
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await eurosCategory.click();
      await page.keyboard.up(modifier);

      // Both categories should be active
      await expect(codeCategory).toHaveClass(/active/);
      await expect(eurosCategory).toHaveClass(/active/);

      // Both posts should be visible (OR logic: posts matching any selected category)
      await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeVisible();

      // URL hash should contain both categories (comma-separated)
      const url = page.url();
      expect(url).toContain('category=');
      expect(url).toContain(encodeURIComponent('code'));
      expect(url).toContain(encodeURIComponent('euros (€)'));
    });

    test(`Deselecting last category with Ctrl+click shows all posts for ${pageName}`, async ({ page }) => {
      await page.goto(`./blog/simple-blog/_site/${pageName}`);

      // Target category sidebar specifically
      const categorySidebar = page.locator('.quarto-listing-category');
      const codeCategory = categorySidebar.locator(`div.category[data-category="${btoa(encodeURIComponent('code'))}"]`);

      // Click on "code" category
      await codeCategory.click();
      await expect(codeCategory).toHaveClass(/active/);

      // Ctrl+click on "code" again to deselect it
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await codeCategory.click();
      await page.keyboard.up(modifier);

      // No category should be active (default state), all posts visible
      await expect(page.getByRole('link', { name: 'Post With Code' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Welcome To My Blog' })).toBeVisible();
    });
  }
});


