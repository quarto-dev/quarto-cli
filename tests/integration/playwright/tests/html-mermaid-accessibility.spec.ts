/*
 * html-mermaid-accessibility.spec.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { expect, test } from "@playwright/test";

test("mermaid diagram keeps its accessible name and description", async ({ page }) => {
  await page.goto("./html/mermaid-accessibility.html");

  const svg = page.locator("svg.mermaid-js");
  await expect(svg).toHaveAttribute("aria-roledescription", /.+/);
  await expect(svg.locator("title")).toHaveText("Build pipeline");
  await expect(svg.locator("desc")).toHaveText(
    "Source goes through build to deploy",
  );
});
