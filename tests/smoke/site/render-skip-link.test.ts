/*
 * render-skip-link.test.ts
 *
 * Verify that website pages include a skip-to-content link as the first
 * element of the body so that keyboard users can bypass the navbar and
 * sidebar (https://github.com/quarto-dev/quarto-cli/issues/14684).
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */
import { docs } from "../../utils.ts";
import { testSite } from "./site.ts";

testSite(docs("site-navigation/index.qmd"), docs("site-navigation/index.qmd"), [
  // skip link is the first element of the body
  'body > a#quarto-skip-link:first-child[href="#quarto-document-content"]',
  // target is focusable via the link
  'main#quarto-document-content[tabindex="-1"]',
], []);
