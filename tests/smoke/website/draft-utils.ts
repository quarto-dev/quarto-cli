/*
* drafts.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { ensureFileRegexMatches, ensureHtmlElementContents, ensureHtmlElements } from "../../verify.ts";


// Specialized verifiers for this test
export const draftPostHasContent = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "posts/draft-post/index.html"), [/DRAFT DOCUMENT/gm])
}

export const draftPostIsEmpty = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "posts/draft-post/index.html"), [], [/DRAFT DOCUMENT/gm]);
}

export const doesntHaveContentLinksToDrafts = (siteDir: string) => {
  return ensureHtmlElements(join(siteDir, "index.html"), [], ["#draft-doc-link"])
}

export const hasContentLinksToDrafts = (siteDir: string) => {
  return ensureHtmlElements(join(siteDir, "index.html"), ["#draft-doc-link"], [])
}

export const hasEnvelopeLinksToDrafts = (siteDir: string) => {
  return ensureHtmlElementContents(join(siteDir, "index.html"), ["#quarto-sidebar", "#quarto-header", ".quarto-listing-default"], ["Draft!!"], []);
}

export const doesntHaveEnvelopeLinksToDrafts = (siteDir: string) => {
  return ensureHtmlElementContents(join(siteDir, "index.html"), ["#quarto-sidebar", "#quarto-header", ".quarto-listing-default"], [], ["Draft!!"]);
}

export const siteMapHasDraft = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "sitemap.xml"), [/posts\/draft-post\/index\.html/gm])
}

export const siteMapDoesntHaveDraft = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "sitemap.xml"), [], [/posts\/draft-post\/index\.html/gm]);
}

export const searchHasDraft = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "search.json"), [/posts\/draft-post\/index\.html/gm])
}

export const searchDoesntHaveDraft = (siteDir: string) => {
  return ensureFileRegexMatches(join(siteDir, "search.json"), [], [/posts\/draft-post\/index\.html/gm]); 
}