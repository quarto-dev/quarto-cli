import { test, expect } from "@playwright/test";
import { deployQuartoDocument, renderQuartoDocument } from "./utils";

test("Verify deploying Quarto manuscript to Connect works as expected", async ({ page }) => {
    const title = "quarto-manuscript-test";
    const quartoDocPath = "/Users/karangathani/Documents/GitHub/quarto-cli/tests/docs/playwright/connect-deploy-tests/connect-manuscript/";

    const renderDoc = await renderQuartoDocument(quartoDocPath);
    const url = await deployQuartoDocument(title, quartoDocPath);

    await page.goto(url);
    await expect(page).toHaveTitle("manuscript");
    await expect(page.locator('h1')).toContainText('manuscript');
    await page.getByRole('heading', { name: 'Table of contents' }).click();
    await expect(page.locator('#section')).toContainText('Section');
    await expect(page.locator('#references')).toContainText('References');
});
