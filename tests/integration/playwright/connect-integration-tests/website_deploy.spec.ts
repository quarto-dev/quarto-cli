import { test, expect } from "@playwright/test";
import { deployQuartoDocument,  renderQuartoDocument } from "./utils"

test("Verify deploying Quarto website to Connect works as expected", async ({ page }) => {
    const title = "quarto-website-test";
    const quartoDocPath = __dirname + "/../../../../tests/docs/playwright/connect-deploy-tests/connect-website/";

    const renderDoc = await renderQuartoDocument(quartoDocPath);
    const url = await deployQuartoDocument(title, quartoDocPath);

    await page.goto(url);
    await expect(page).toHaveTitle("website");
    await expect(page.getByRole('heading')).toContainText('website');
    await expect(page.locator('#quarto-document-content')).toContainText('This is a Quarto website.');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('paragraph')).toContainText('About this site');
});
