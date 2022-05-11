import { PuppeteerDeno } from "./deno/Puppeteer.ts";
import { PUPPETEER_REVISIONS } from "../vendor/puppeteer-core/puppeteer/revisions.js";

export const initializePuppeteerDeno = (): PuppeteerDeno => {
  const productName = Deno.env.get("PUPPETEER_PRODUCT") as "chrome" | "firefox";

  let preferredRevision = PUPPETEER_REVISIONS.chromium;
  if (productName == "firefox") preferredRevision = PUPPETEER_REVISIONS.firefox;

  return new PuppeteerDeno({
    preferredRevision,
    productName,
  });
};
