/*
 * website-search.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "../../../deno_ral/fs.ts";
import { basename, join, relative } from "../../../deno_ral/path.ts";
import * as pagefind from "pagefind";

// currently not building the index here so not using fuse
// @ deno-types="fuse/dist/fuse.d.ts"
// import Fuse from "fuse/dist/fuse.esm.min.js";

import { DOMParser, Element } from "../../../core/deno-dom.ts";

import { resourcePath } from "../../../core/resources.ts";

import {
  DependencyFile,
  Format,
  FormatDependency,
  FormatLanguage,
} from "../../../config/types.ts";
import {
  kProjectLibDir,
  NavigationItemObject,
  ProjectContext,
} from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";

import {
  clipboardDependency,
  kBootstrapDependencyName,
} from "../../../format/html/format-html-shared.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { projectOffset } from "../../project-shared.ts";

import {
  inputFileHref,
  navbarItemForSidebar,
  websiteNavigationConfig,
} from "./website-shared.ts";
import {
  websiteConfig,
  websiteConfigMetadata,
  websitePath,
  websiteTitle,
} from "./website-config.ts";
import { sassLayer } from "../../../core/sass.ts";
import { TempContext } from "../../../core/temp.ts";
import { warning } from "../../../deno_ral/log.ts";
import {
  cookieConsentEnabled,
  scriptTagWithConsent,
} from "./website-analytics.ts";
import { kLanguageDefaults } from "../../../config/constants.ts";
import { pathWithForwardSlashes } from "../../../core/path.ts";
import { isHtmlFileOutput } from "../../../config/format.ts";
import { projectIsBook } from "../../project-shared.ts";
import { encodeHtml } from "../../../core/html.ts";
import { breadCrumbs, sidebarForHref } from "./website-shared.ts";
import { resolveInputTargetForOutputFile } from "../../project-index.ts";
import { isDraftVisible, projectDraftMode } from "./website-utils.ts";

// The main search key
export const kSearch = "search";

// The type of search UI (e.g. overlay or textbox)
const kType = "type";

// The user facing options
// Should the search input appear on the sidebar or the navbar
const kLocation = "location";

// Show a copy button to copy the search url to the clipboard
const kCopyButton = "copy-button";

// Collapse sections of the same documents when showing them in the results
const kCollapseAfter = "collapse-after";

// Where to place the search results
const kPanelPlacement = "panel-placement";

// Keyboard shortcut(s) to use to launch search
const kKbShortcutSearch = "keyboard-shortcut";

// The number of results to return
const kLimit = "limit";

// Whether to show the parent in the search results
const kShowItemContext = "show-item-context";

// Any algolia configuration
const kAlgolia = "algolia";

// The search engine backend
const kEngine = "engine";

// Pagefind-specific configuration
const kPagefind = "pagefind";
const kRootSelector = "root-selector";
const kExcludeSelectors = "exclude-selectors";
const kForceLanguage = "force-language";
const kRanking = "ranking";
const kPageLength = "page-length";
const kTermFrequency = "term-frequency";
const kTermSaturation = "term-saturation";
const kTermSimilarity = "term-similarity";

export type SearchEngine = "fuse" | "pagefind" | "algolia";

interface SearchOptions {
  [kLocation]: SearchInputLocation;
  [kCopyButton]: boolean;
  [kCollapseAfter]: boolean | number;
  [kType]: "textbox" | "overlay";
  [kPanelPlacement]: "start" | "end" | "full-width" | "input-wrapper-width";
  [kLimit]?: number;
  [kEngine]?: SearchEngine;
  [kAlgolia]?: SearchOptionsAlgolia;
  [kPagefind]?: SearchOptionsPagefind;
  [kLanguageDefaults]?: FormatLanguage;
  [kKbShortcutSearch]?: string[];
  [kShowItemContext]?: boolean | "parent" | "root" | "tree";
}

interface SearchOptionsPagefind {
  [kRootSelector]?: string;
  [kExcludeSelectors]?: string[];
  [kForceLanguage]?: string;
  [kRanking]?: {
    [kPageLength]?: number;
    [kTermFrequency]?: number;
    [kTermSaturation]?: number;
    [kTermSimilarity]?: number;
  };
}

const kSearchOnlyApiKey = "search-only-api-key";
const kSearchApplicationId = "application-id";
const kSearchParams = "params";
const kSearchIndexName = "index-name";
const kIndexFields = "index-fields";
const kHref = "href";
const kSection = "section";
const kTitle = "title";
const kText = "text";
const kAnalyticsEvents = "analytics-events";
const kShowLogo = "show-logo";
const kCookieConsentEnabled = "cookie-consent-enabled";

interface SearchOptionsAlgolia {
  [kSearchOnlyApiKey]?: string;
  [kSearchApplicationId]?: string;
  [kSearchIndexName]?: string;
  [kIndexFields]?: {
    [kHref]?: string;
    [kSection]?: string;
    [kTitle]?: string;
    [kText]?: string;
  };
  [kSearchParams]?: Record<string, unknown>;
  [kAnalyticsEvents]?: boolean;
  [kShowLogo]?: boolean;
  [kCookieConsentEnabled]?: boolean;
}

export type SearchInputLocation = "navbar" | "sidebar";

interface SearchDoc {
  objectID: string;
  href: string;
  title: string;
  section: string;
  text: string;
  crumbs?: string[];
}

export async function updateSearchIndex(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  // calculate output dir and search.json path
  const outputDir = projectOutputDir(context);
  const searchJsonPath = join(outputDir, "search.json");
  const searchJson = existsSync(searchJsonPath)
    ? Deno.readTextFileSync(searchJsonPath)
    : undefined;

  // start with a set of search docs if this is incremental
  const searchDocs = new Array<SearchDoc>();
  let generateIndex = true;
  if (incremental && searchJson) {
    // Read the existing index
    try {
      const existingSearchJson = JSON.parse(searchJson);

      // Ensure that existing documents include an object Id
      searchDocs.push(...(existingSearchJson as SearchDoc[]));
    } catch {
      generateIndex = false;
      warning(
        "Unable to read search index - it may be corrupt. Please re-render the entire site to create a valid search index.",
      );
    }
  }

  if (generateIndex) {
    const draftMode = projectDraftMode(context);
    let updatedSearchDocs: SearchDoc[] = [...searchDocs];
    for (const outputFile of outputFiles) {
      // find file/href
      const file = outputFile.file;
      const href = pathWithForwardSlashes(relative(outputDir, file));

      const index = await resolveInputTargetForOutputFile(
        context,
        relative(outputDir, outputFile.file),
      );
      const draft = index ? index.draft : false;

      // if this is excluded then remove and return
      if (
        outputFile.format.metadata[kSearch] === false ||
        (draft === true && !isDraftVisible(draftMode))
      ) {
        updatedSearchDocs = updatedSearchDocs.filter((doc) => {
          return doc.href !== href &&
            !doc.href.startsWith(href + "#");
        });
        continue;
      }

      // if this isn't html then skip it
      if (!isHtmlFileOutput(outputFile.format.pandoc)) {
        continue;
      }

      // add or update search doc
      const updateDoc = (doc: SearchDoc) => {
        const idx = updatedSearchDocs.findIndex((d) => d.href === doc.href);
        if (idx !== -1) {
          updatedSearchDocs[idx] = doc;
        } else {
          updatedSearchDocs.push(doc);
        }
      };

      // parse doc
      const contents = Deno.readTextFileSync(file);
      const doc = new DOMParser().parseFromString(contents, "text/html")!;

      // determine title
      const findTitle = () => {
        const titleEl = doc.querySelector("h1.title");
        if (titleEl) {
          return titleEl;
        } else {
          const title = doc.querySelector("main h1");
          if (title) {
            return title;
          } else {
            return undefined;
          }
        }
      };

      // determine crumbs
      const navHref = `/${href}`;
      const sidebar = sidebarForHref(navHref, outputFile.format);

      const bc = breadCrumbs(navHref, sidebar);

      const crumbs = bc.length > 0
        ? bc.filter((crumb) => {
          return crumb.text !== undefined;
        }).map((crumb) => {
          return crumb.text;
        }) as string[]
        : undefined;

      // If we found a sidebar, try to determine whether there is a navbar
      // link that points to this page / sidebar. If so, inject that level
      // into the crumbs as well. An attempt at improving #7803 and providing
      // better crumbs
      // deno-lint-ignore no-explicit-any
      const mergeNavBarSearchCrumbs = (outputFile.format.metadata as any)
        ?.website?.search?.["merge-navbar-crumbs"];
      if (
        mergeNavBarSearchCrumbs !== false &&
        crumbs && sidebar
      ) {
        const navItem = navbarItemForSidebar(sidebar, outputFile.format);
        if (navItem) {
          if (typeof navItem === "object") {
            const navbarParentText = (navItem as NavigationItemObject).text;
            if (navbarParentText) {
              if (crumbs.length > 0 && crumbs[0] !== navbarParentText) {
                crumbs.unshift(navbarParentText);
              }
            }
          }
        }
      }
      const titleEl = findTitle();
      const title = titleEl
        ? titleEl.textContent
        : (websiteTitle(context.config) || "");

      // remove pandoc generated header and toc
      const header = doc.getElementById("title-block-header");
      if (header) {
        header.remove();
      }
      const toc = doc.querySelector(`nav[role="doc-toc"]`);
      if (toc) {
        toc.remove();
      }

      // Remove scripts and style sheets (they are not considered searchable)
      // Note that `innerText` would also ignore stylesheets and script tags
      // but that also ignores css hidden elements, which we'd like to be searchable
      // so we're manually stripping these from the indexed doc
      ["script", "style"].forEach((tag) => {
        const els = doc.querySelectorAll(tag);
        if (els) {
          els.forEach((el) => (el as Element).remove());
        }
      });

      // We always take the first child of the main region (whether that is a p or section)
      // and create an index entry for the page itself (with no hash). If there is other
      // 'unsectioned' content on the page, we include that as well.
      //
      // That search UI will know how to handle entries for pages with no hash and merge them
      // into the 'page' result when it makes sense to do so.
      // Grab the first child of main, and create a page entry using that.

      // if there are additional level 2 sections then create sub-docs for them
      const sections = doc.querySelectorAll(
        "section.level2,section.footnotes",
      );
      if (sections.length > 0) {
        const mainSelector = projectIsBook(context)
          ? "main > section:first-of-type"
          : "main.content";

        const mainEl = doc.querySelector(mainSelector);
        const firstEl = mainEl?.firstElementChild;
        const pageText: string[] = [];
        if (firstEl) {
          // Remove any headings
          const headings = firstEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
          headings.forEach((heading) => (heading as Element).remove());

          // Add the text contents as the text for this page
          const trimmed = firstEl.textContent.trim();
          if (trimmed) {
            pageText.push(trimmed);
          }
          firstEl.remove();
        }

        // If there are any paragraphs residing outside a section, just
        // include that in the document entry
        const paragraphNodes = doc.querySelectorAll(
          `${mainSelector} > p, ${mainSelector} > div.cell, main > p`,
        );

        const addToIndex = (paragraphNode: Element) => {
          const text = paragraphNode.textContent.trim();
          if (text) {
            pageText.push(text);
          }

          // Since these are already indexed with the main entry, remove them
          // so they are not indexed again
          paragraphNode.remove();
        };

        for (const paragraphNode of paragraphNodes) {
          addToIndex(paragraphNode as Element);
        }

        // Add forced inclusions to the index
        const forcedInclusions = doc.querySelectorAll(
          `.quarto-include-in-search-index`,
        );
        for (const forcedInclusion of forcedInclusions) {
          addToIndex(forcedInclusion as Element);
        }

        if (pageText.length > 0) {
          updateDoc({
            objectID: href,
            href: href,
            title,
            section: "",
            text: encodeHtml(pageText.join("\n")),
            crumbs,
          });
        }

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i] as Element;
          const h2 = section.querySelector("h2");
          if (section.id) {
            const sectionTitle = h2 ? h2.textContent : "";
            const hrefWithAnchor = `${href}#${section.id}`;
            const sectionText = section.textContent.trim();
            if (h2) {
              h2.remove();
            }

            if (sectionText) {
              // Don't index empty sections
              updateDoc({
                objectID: hrefWithAnchor,
                href: hrefWithAnchor,
                title,
                section: sectionTitle,
                text: encodeHtml(sectionText),
                crumbs,
              });
            }
          }
        }
      } else { // otherwise a single doc
        const main = doc.querySelector("main");
        if (main) {
          const mainText = main.textContent.trim();
          if (mainText) {
            // Don't index empty documents
            updateDoc({
              objectID: href,
              href,
              title,
              section: "",
              text: encodeHtml(mainText),
              crumbs,
            });
          }
        }
      }
    }

    // write search docs if they have changed
    if (updatedSearchDocs.length > 0) {
      const updatedSearchJson = JSON.stringify(updatedSearchDocs, undefined, 2);
      if (searchJson !== updatedSearchJson) {
        Deno.writeTextFileSync(searchJsonPath, updatedSearchJson);
      }
    }
  }
}

export async function runPagefindIndex(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
) {
  const outputDir = projectOutputDir(context);

  // Get pagefind-specific options
  const options = await searchOptions(context);
  const pagefindOpts = options?.[kPagefind];

  // Annotate HTML files with breadcrumbs and search exclusions before indexing
  await annotateHtmlForPagefind(context, outputFiles);

  // Use the statically imported pagefind module

  // Build the createIndex config
  const rootSelector = pagefindOpts?.[kRootSelector] ?? "main";
  const defaultExcludeSelectors = [
    "nav[role='doc-toc']",
    "#title-block-header",
    "script",
    "style",
    ".sidebar",
    ".quarto-title-block",
  ];
  const userExcludeSelectors = pagefindOpts?.[kExcludeSelectors] ?? [];
  const excludeSelectors = [
    ...defaultExcludeSelectors,
    ...userExcludeSelectors,
  ];

  const indexConfig: Record<string, unknown> = {
    rootSelector,
    excludeSelectors,
  };
  if (pagefindOpts?.[kForceLanguage]) {
    indexConfig.forceLanguage = pagefindOpts[kForceLanguage];
  }

  // Create index
  const { index, errors: createErrors } = await pagefind.createIndex(
    indexConfig,
  );
  if (createErrors.length > 0) {
    warning("Pagefind index creation warnings: " + createErrors.join(", "));
  }
  if (!index) {
    warning("Pagefind failed to create index");
    return;
  }

  // Index the output directory
  const { errors: addErrors, page_count } = await index.addDirectory({
    path: outputDir,
  });
  if (addErrors.length > 0) {
    warning("Pagefind indexing warnings: " + addErrors.join(", "));
  }

  // Write the pagefind bundle to the output directory
  const pagefindOutputPath = join(outputDir, "pagefind");
  const { errors: writeErrors } = await index.writeFiles({
    outputPath: pagefindOutputPath,
  });
  if (writeErrors.length > 0) {
    warning(
      "Pagefind write warnings: " + writeErrors.join(", "),
    );
  }

  await pagefind.close();
}

async function annotateHtmlForPagefind(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
) {
  const outputDir = projectOutputDir(context);
  const draftMode = projectDraftMode(context);

  for (const outputFile of outputFiles) {
    // Skip non-HTML files
    if (!isHtmlFileOutput(outputFile.format.pandoc)) {
      continue;
    }

    const file = outputFile.file;
    const href = pathWithForwardSlashes(relative(outputDir, file));

    // Check for search exclusion (same logic as updateSearchIndex)
    const index = await resolveInputTargetForOutputFile(
      context,
      relative(outputDir, outputFile.file),
    );
    const draft = index ? index.draft : false;
    const excluded = outputFile.format.metadata[kSearch] === false ||
      (draft === true && !isDraftVisible(draftMode));

    // Read the HTML
    const html = Deno.readTextFileSync(file);
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) continue;

    let modified = false;

    // For excluded pages, inject data-pagefind-ignore on <body>
    if (excluded) {
      const body = doc.querySelector("body");
      if (body) {
        (body as Element).setAttribute("data-pagefind-ignore", "all");
        modified = true;
      }
    }

    // Compute and inject breadcrumbs (same logic as updateSearchIndex)
    const navHref = `/${href}`;
    const sidebar = sidebarForHref(navHref, outputFile.format);
    if (sidebar) {
      const bc = breadCrumbs(navHref, sidebar);
      const crumbTexts = bc.length > 0
        ? bc.filter((crumb) => crumb.text !== undefined)
          .map((crumb) => crumb.text as string)
        : [];

      // Merge navbar crumbs if applicable
      // deno-lint-ignore no-explicit-any
      const mergeNavBarSearchCrumbs = (outputFile.format.metadata as any)
        ?.website?.search?.["merge-navbar-crumbs"];
      if (mergeNavBarSearchCrumbs !== false && crumbTexts.length > 0) {
        const navItem = navbarItemForSidebar(sidebar, outputFile.format);
        if (navItem && typeof navItem === "object") {
          const navbarParentText = (navItem as NavigationItemObject).text;
          if (
            navbarParentText && crumbTexts.length > 0 &&
            crumbTexts[0] !== navbarParentText
          ) {
            crumbTexts.unshift(navbarParentText);
          }
        }
      }

      if (crumbTexts.length > 0) {
        const mainEl = doc.querySelector("main");
        if (mainEl) {
          const meta = doc.createElement("meta");
          (meta as Element).setAttribute(
            "data-pagefind-meta",
            `crumbs:${crumbTexts.join("||")}`,
          );
          mainEl.insertBefore(meta, mainEl.firstChild);
          modified = true;
        }
      }
    }

    // Write back if modified
    if (modified) {
      // Serialize back to HTML, preserving the original doctype
      const doctype = html.match(/^<!DOCTYPE[^>]*>/i)?.[0] ?? "";
      const serialized = doctype + "\n" +
        (doc.documentElement?.outerHTML ?? "");
      Deno.writeTextFileSync(file, serialized);
    }
  }
}

const kDefaultCollapse = 3;

export async function searchOptions(
  project: ProjectContext,
): Promise<SearchOptions | undefined> {
  const searchMetadata = websiteConfigMetadata(kSearch, project.config);

  // The location of the search input
  const location = await searchInputLocation(project);

  if (searchMetadata) {
    // Sort out collapsing (by default, show 2 sections per document)
    const collapseMatches: number | boolean =
      typeof (searchMetadata[kCollapseAfter]) === "number"
        ? searchMetadata[kCollapseAfter] as number
        : searchMetadata[kCollapseAfter] !== false
        ? kDefaultCollapse
        : false;

    // Determine the search engine
    const algolia = algoliaOptions(searchMetadata, project);
    const engine = searchEngine(searchMetadata, algolia);
    const pagefindOpts = engine === "pagefind"
      ? pagefindOptions(searchMetadata)
      : undefined;

    return {
      [kLocation]: location,
      [kCopyButton]: searchMetadata[kCopyButton] === true,
      [kCollapseAfter]: collapseMatches,
      [kPanelPlacement]: location === "navbar" ? "end" : "start",
      [kType]: searchType(searchMetadata[kType], location),
      [kLimit]: searchInputLimit(searchMetadata),
      [kEngine]: engine,
      [kAlgolia]: algolia,
      [kPagefind]: pagefindOpts,
      [kKbShortcutSearch]: searchKbdShortcut(searchMetadata),
      [kShowItemContext]: searchShowItemContext(searchMetadata),
    };
  } else {
    const searchRaw = websiteConfig(kSearch, project.config);
    if (searchRaw === undefined || !!searchRaw) {
      // The default configuration if search is undefined or true
      return {
        [kLocation]: location,
        [kCopyButton]: false,
        [kCollapseAfter]: kDefaultCollapse,
        [kPanelPlacement]: location === "navbar" ? "end" : "start",
        [kType]: searchType(undefined, location),
        [kLimit]: searchInputLimit(undefined),
        [kKbShortcutSearch]: searchKbdShortcut(undefined),
        [kShowItemContext]: searchShowItemContext(searchMetadata),
      };
    }
  }
}

function searchInputLimit(
  searchConfig: string | Record<string, unknown> | undefined,
) {
  if (searchConfig && typeof searchConfig === "object") {
    const limit = searchConfig[kLimit];
    if (typeof limit === "number") {
      return limit;
    }
  }
  return 50;
}

function searchKbdShortcut(
  searchConfig: string | Record<string, unknown> | undefined,
) {
  if (searchConfig && typeof searchConfig === "object") {
    const kbd = searchConfig[kKbShortcutSearch];
    if (kbd) {
      if (Array.isArray(kbd)) {
        return kbd;
      } else {
        return [kbd];
      }
    }
  }
  return ["f", "/", "s"];
}

function searchShowItemContext(
  searchConfig: string | Record<string, unknown> | undefined,
) {
  if (searchConfig && typeof searchConfig === "object") {
    return searchConfig[kShowItemContext] as
      | boolean
      | "tree"
      | "root"
      | "parent";
  } else {
    return false;
  }
}

function searchType(
  userType: unknown,
  location: SearchInputLocation,
): "overlay" | "textbox" {
  if (userType && typeof userType === "string") {
    switch (userType) {
      case "overlay":
        return "overlay";
      default:
      case "textbox":
        return "textbox";
    }
  } else {
    if (location === "sidebar") {
      return "textbox";
    } else {
      return "overlay";
    }
  }
}

function algoliaOptions(
  searchConfig: Record<string, unknown>,
  project: ProjectContext,
) {
  const algoliaRaw = searchConfig[kAlgolia];
  if (algoliaRaw && typeof algoliaRaw === "object") {
    const algoliaObj = algoliaRaw as SearchOptionsAlgolia;
    const applicationId = algoliaObj[kSearchApplicationId];
    const apiKey = algoliaObj[kSearchOnlyApiKey];
    const indexName = algoliaObj[kSearchIndexName];
    const params = algoliaObj[kSearchParams];
    const indexKeys = algoliaObj[kIndexFields];
    const analytics = !!algoliaObj[kAnalyticsEvents];
    const showLogo = !!algoliaObj[kShowLogo];
    return {
      [kSearchApplicationId]: applicationId,
      [kSearchOnlyApiKey]: apiKey,
      [kSearchIndexName]: indexName,
      [kSearchParams]: params,
      [kIndexFields]: indexKeys,
      [kAnalyticsEvents]: analytics,
      [kShowLogo]: showLogo,
      libDir: project?.config?.project[kProjectLibDir],
    };
  } else {
    return undefined;
  }
}

function searchEngine(
  searchConfig: Record<string, unknown>,
  algolia: SearchOptionsAlgolia | undefined,
): SearchEngine {
  const engineRaw = searchConfig[kEngine];
  if (typeof engineRaw === "string") {
    if (engineRaw === "pagefind" || engineRaw === "algolia" || engineRaw === "fuse") {
      return engineRaw;
    }
  }
  // Auto-detect algolia when algolia config is present (backward compat)
  if (algolia) {
    return "algolia";
  }
  return "fuse";
}

function pagefindOptions(
  searchConfig: Record<string, unknown>,
): SearchOptionsPagefind | undefined {
  const pagefindRaw = searchConfig[kPagefind];
  if (pagefindRaw && typeof pagefindRaw === "object") {
    const pagefindObj = pagefindRaw as Record<string, unknown>;
    const result: SearchOptionsPagefind = {};
    if (typeof pagefindObj[kRootSelector] === "string") {
      result[kRootSelector] = pagefindObj[kRootSelector] as string;
    }
    if (Array.isArray(pagefindObj[kExcludeSelectors])) {
      result[kExcludeSelectors] = pagefindObj[kExcludeSelectors] as string[];
    }
    if (typeof pagefindObj[kForceLanguage] === "string") {
      result[kForceLanguage] = pagefindObj[kForceLanguage] as string;
    }
    const rankingRaw = pagefindObj[kRanking];
    if (rankingRaw && typeof rankingRaw === "object") {
      const r = rankingRaw as Record<string, unknown>;
      result[kRanking] = {};
      if (typeof r[kPageLength] === "number") {
        result[kRanking][kPageLength] = r[kPageLength] as number;
      }
      if (typeof r[kTermFrequency] === "number") {
        result[kRanking][kTermFrequency] = r[kTermFrequency] as number;
      }
      if (typeof r[kTermSaturation] === "number") {
        result[kRanking][kTermSaturation] = r[kTermSaturation] as number;
      }
      if (typeof r[kTermSimilarity] === "number") {
        result[kRanking][kTermSimilarity] = r[kTermSimilarity] as number;
      }
    }
    return result;
  }
  return undefined;
}

export async function searchInputLocation(
  project: ProjectContext,
): Promise<SearchInputLocation> {
  const searchConfig = websiteConfigMetadata(kSearch, project.config);
  if (searchConfig && searchConfig[kLocation]) {
    switch (searchConfig[kLocation]) {
      case "sidebar":
        return "sidebar";
      case "navbar":
      default:
        return "navbar";
    }
  } else {
    const { navbar } = await websiteNavigationConfig(project);
    if (navbar) {
      return "navbar";
    } else {
      return "sidebar";
    }
  }
}

const kDependencyName = "quarto-search";
export function websiteSearchSassBundle() {
  const scssPath = searchDependency("quarto-search.scss").path;
  const layer = sassLayer(scssPath);
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      name: "quarto-search.css",
      ...layer,
    },
  };
}

export async function websiteSearchIncludeInHeader(
  project: ProjectContext,
  format: Format,
  temp: TempContext,
) {
  // Generates a script tag that contains the options for configuring search
  // which is ready in quarto-search.js
  const websiteSearchScript = temp.createFile({ suffix: "-search.html" });
  const options = await searchOptions(project) || {} as SearchOptions;
  options[kLanguageDefaults] = {} as FormatLanguage;
  Object.keys(format.language).forEach((key) => {
    if (key.startsWith("search-")) {
      options[kLanguageDefaults]![key] = format.language[key];
    }
  });

  const includes: string[] = [];

  // Process all Algolia configuration and scripts
  if (options[kAlgolia]) {
    includes.push(kAlogioSearchApiScript);
    if (options[kAlgolia][kAnalyticsEvents]) {
      const cookieConsent = cookieConsentEnabled(project);
      // Set cookie consent flag for JavaScript configuration
      options[kAlgolia][kCookieConsentEnabled] = cookieConsent;
      // Add Algolia Insights scripts with proper consent handling
      includes.push(algoliaSearchInsightsScript(cookieConsent));
      includes.push(autocompleteInsightsPluginScript(cookieConsent));
    }
  }

  // Serialize search options to JSON after all modifications
  const searchOptionsJson = JSON.stringify(options, null, 2);
  const searchOptionsScript =
    `<script id="quarto-search-options" type="application/json">${searchOptionsJson}</script>`;
  // Prepend search options script to beginning of includes
  includes.unshift(searchOptionsScript);

  Deno.writeTextFileSync(websiteSearchScript, includes.join("\n"));
  return websiteSearchScript;
}

export async function websiteSearchDependency(
  project: ProjectContext,
  source: string,
): Promise<FormatDependency[]> {
  const searchDependencies: FormatDependency[] = [];
  const resources: DependencyFile[] = [];

  const options = await searchOptions(project);
  if (options) {
    const sourceRelative = relative(project.dir, source);
    const offset = projectOffset(project, source);
    const href = inputFileHref(sourceRelative);

    const scripts = [
      searchDependency("autocomplete.umd.js"),
      ...(options[kEngine] !== "pagefind"
        ? [searchDependency("fuse.min.js")]
        : []),
      searchDependency("quarto-search.js"),
    ];

    // If there are Algolia options specified, check that they are complete
    // and add the algolia search dependency
    const algoliaOpts = options[kAlgolia];
    if (algoliaOpts) {
      if (algoliaOpts[kShowLogo]) {
        // Add the logo as a resource
        resources.push(searchDependency("search-by-algolia.svg"));
      }

      if (
        algoliaOpts[kSearchApplicationId] &&
        algoliaOpts[kSearchOnlyApiKey] &&
        algoliaOpts[kSearchIndexName]
      ) {
        // The autocomplete algolia plugin
        scripts.push(searchDependency("autocomplete-preset-algolia.umd.js"));
      } else {
        warning(
          "Algolia search is misconfigured. Please ensure that you provide an application-id, search-only-api-key, and index-name.",
        );
      }
    }

    searchDependencies.push(clipboardDependency());
    searchDependencies.push({
      name: kDependencyName,
      meta: {
        "quarto:offset": href === "/404.html"
          ? websitePath(project.config)
          : offset + "/",
      },
      stylesheets: [],
      scripts,
      resources,
    });
  }
  return searchDependencies;
}

function searchDependency(resource: string) {
  return {
    name: basename(resource),
    path: resourcePath(`projects/website/search/${resource}`),
  };
}

function autocompleteInsightsPluginScript(cookieConsent: boolean) {
  return scriptTagWithConsent(
    cookieConsent,
    "tracking",
    "",
    "https://cdn.jsdelivr.net/npm/@algolia/autocomplete-plugin-algolia-insights",
  );
}

function algoliaSearchInsightsScript(cookieConsent: boolean) {
  return scriptTagWithConsent(
    cookieConsent,
    "tracking",
    `var ALGOLIA_INSIGHTS_SRC = "https://cdn.jsdelivr.net/npm/search-insights/dist/search-insights.iife.min.js";
!function(e,a,t,n,s,i,c){e.AlgoliaAnalyticsObject=s,e[s]=e[s]||function(){
(e[s].queue=e[s].queue||[]).push(arguments)},i=a.createElement(t),c=a.getElementsByTagName(t)[0],
i.async=1,i.src=n,c.parentNode.insertBefore(i,c)
}(window,document,"script",ALGOLIA_INSIGHTS_SRC,"aa");`,
  );
}

const kAlogioSearchApiScript =
  `<script src="https://cdn.jsdelivr.net/npm/algoliasearch@4.5.1/dist/algoliasearch-lite.umd.js"></script>
`;
