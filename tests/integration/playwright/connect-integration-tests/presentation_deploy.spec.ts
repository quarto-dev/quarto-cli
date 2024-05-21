import { test, expect } from "@playwright/test";
import { deployQuartoDocument, renderQuartoDocument } from "./utils"

test("Verify deploying Quarto presentation to Connect works as expected", async ({ page }) => {
    const title = "quarto-presentation-test";
    const quartoDocPath = "/Users/karangathani/Documents/GitHub/quarto-cli/tests/docs/playwright/connect-deploy-tests/connect-presentation/";

    const renderDoc = await renderQuartoDocument(quartoDocPath);
    const url = await deployQuartoDocument(title, `${quartoDocPath}*.qmd`);

    await page.goto(url);
    await expect(page).toHaveTitle("Habits");
    await expect(page.getByRole("heading")).toContainText("Habits");
    await expect(page.locator("#title-slide")).toContainText("Jane Doe");
});
