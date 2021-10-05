/*
* website-search.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, join, relative } from "path/mod.ts";

// currently not building the index here so not using fuse
// @deno-types="fuse/dist/fuse.d.ts"
// import Fuse from "fuse/dist/fuse.esm.min.js";

import { DOMParser, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { resourcePath } from "../../../core/resources.ts";
import { isHtmlContent } from "../../../core/mime.ts";

import { FormatDependency } from "../../../config/types.ts";
import { ProjectContext } from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";

import {
  clipboardDependency,
  kBootstrapDependencyName,
} from "../../../format/html/format-html-shared.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { projectOffset } from "../../project-shared.ts";

import { inputFileHref, websiteNavigationConfig } from "./website-shared.ts";
import { websiteConfig, websitePath, websiteTitle } from "./website-config.ts";
import { sassLayer } from "../../../command/render/sass.ts";
import { sessionTempFile } from "../../../core/temp.ts";
import { warning } from "log/mod.ts";
import {
  cookieConsentEnabled,
  scriptTagWithConsent,
} from "./website-analytics.ts";

// The main search key
const kSearch = "search";

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

// The number of results to return
const kLimit = "limit";

// Any aloglia configuration
const kAlgolia = "algolia";

interface SearchOptions {
  [kLocation]: SearchInputLocation;
  [kCopyButton]: boolean;
  [kCollapseAfter]: boolean | number;
  [kType]: "textbox" | "overlay";
  [kPanelPlacement]: "start" | "end" | "full-width" | "input-wrapper-width";
  [kLimit]?: number;
  [kAlgolia]?: SearchOptionsAlgolia;
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
}

export type SearchInputLocation = "navbar" | "sidebar";

interface SearchDoc {
  objectID: string;
  href: string;
  title: string;
  section: string;
  text: string;
}

export function updateSearchIndex(
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
  if (incremental && searchJson) {
    // Read the existing index
    const existingSearchJson = JSON.parse(searchJson);

    // Ensure that existing documents include an object Id
    searchDocs.push(...(existingSearchJson as SearchDoc[]));
  }

  // create search docs
  const updatedSearchDocs: SearchDoc[] = outputFiles.reduce(
    (searchDocs: SearchDoc[], outputFile) => {
      // find file/href
      const file = outputFile.file;
      const href = relative(outputDir, file);

      // if this is excluded then remove and return
      if (outputFile.format.metadata[kSearch] === false) {
        searchDocs = searchDocs.filter((doc) => {
          return doc.href !== href &&
            !doc.href.startsWith(href + "#");
        });
        return searchDocs;
      }

      // if this isn't html then skip it
      if (!isHtmlContent(file)) {
        return searchDocs;
      }

      // add or update search doc
      const updateDoc = (doc: SearchDoc) => {
        const idx = searchDocs.findIndex((d) => d.href === doc.href);
        if (idx !== -1) {
          searchDocs[idx] = doc;
        } else {
          searchDocs.push(doc);
        }
      };

      // parse doc
      const contents = Deno.readTextFileSync(file);
      const doc = new DOMParser().parseFromString(contents, "text/html")!;

      // determine title
      const titleEl = doc.querySelector("h1.title");
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
          els.forEach((el) => el.remove());
        }
      });

      // if there are level 2 sections then create sub-docs for them
      const sections = doc.querySelectorAll("section.level2");
      if (sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i] as Element;
          const h2 = section.querySelector("h2");
          if (h2 && section.id) {
            const sectionTitle = h2.textContent;
            const hrefWithAnchor = `${href}#${section.id}`;
            h2.remove();
            updateDoc({
              objectID: hrefWithAnchor,
              href: hrefWithAnchor,
              title,
              section: sectionTitle,
              text: section.textContent.trim(),
            });
          }
        }
      } else { // otherwise a single doc
        const main = doc.querySelector("main");
        if (main) {
          updateDoc({
            objectID: href,
            href,
            title,
            section: "",
            text: main.textContent.trim(),
          });
        }
      }

      return searchDocs;
    },
    searchDocs,
  );

  // write search docs if they have changed
  if (updatedSearchDocs.length > 0) {
    const updatedSearchJson = JSON.stringify(updatedSearchDocs, undefined, 2);
    if (searchJson !== updatedSearchJson) {
      Deno.writeTextFileSync(searchJsonPath, updatedSearchJson);
    }
  }
}

export function searchOptions(
  project: ProjectContext,
): SearchOptions | undefined {
  const searchConfig = websiteConfig(kSearch, project.config);

  // The location of the search input
  const location = searchInputLocation(project);

  if (searchConfig && typeof (searchConfig) === "object") {
    // Sort out collapsing (by default, show 2 sections per document)
    const collapseMatches: number | boolean =
      typeof (searchConfig[kCollapseAfter]) === "number"
        ? searchConfig[kCollapseAfter] as number
        : searchConfig[kCollapseAfter] !== false
        ? 2
        : false;

    return {
      [kLocation]: location,
      [kCopyButton]: searchConfig[kCopyButton] === true,
      [kCollapseAfter]: collapseMatches,
      [kPanelPlacement]: location === "navbar" ? "end" : "start",
      [kType]: searchType(searchConfig[kType], location),
      [kLimit]: searchInputLimit(searchConfig),
      [kAlgolia]: algoliaOptions(searchConfig),
    };
  } else if (searchConfig === undefined || !!searchConfig) {
    // The default configuration if search is undefined or true
    return {
      [kLocation]: location,
      [kCopyButton]: false,
      [kCollapseAfter]: 2,
      [kPanelPlacement]: location === "navbar" ? "end" : "start",
      [kType]: searchType(undefined, location),
      [kLimit]: searchInputLimit(undefined),
    };
  }
}

function searchInputLimit(
  searchConfig: string | Record<string, unknown> | undefined,
) {
  if (searchConfig && typeof (searchConfig) === "object") {
    const limit = searchConfig[kLimit];
    if (typeof (limit) === "number") {
      return limit;
    }
  }
  return 20;
}

function searchType(
  userType: unknown,
  location: SearchInputLocation,
): "overlay" | "textbox" {
  if (userType && typeof (userType) === "string") {
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

function algoliaOptions(searchConfig: Record<string, unknown>) {
  const algoliaRaw = searchConfig[kAlgolia];
  if (algoliaRaw && typeof (algoliaRaw) === "object") {
    const algoliaObj = algoliaRaw as SearchOptionsAlgolia;
    const applicationId = algoliaObj[kSearchApplicationId];
    const apiKey = algoliaObj[kSearchOnlyApiKey];
    const indexName = algoliaObj[kSearchIndexName];
    const params = algoliaObj[kSearchParams];
    const indexKeys = algoliaObj[kIndexFields];
    const analytics = !!algoliaObj[kAnalyticsEvents];
    return {
      [kSearchApplicationId]: applicationId,
      [kSearchOnlyApiKey]: apiKey,
      [kSearchIndexName]: indexName,
      [kSearchParams]: params,
      [kIndexFields]: indexKeys,
      [kAnalyticsEvents]: analytics,
    };
  } else {
    return undefined;
  }
}

function searchInputLocation(
  project: ProjectContext,
): SearchInputLocation {
  const searchConfig = websiteConfig(kSearch, project.config);
  if (
    searchConfig && typeof (searchConfig) === "object" &&
    searchConfig[kLocation]
  ) {
    switch (searchConfig[kLocation]) {
      case "sidebar":
        return "sidebar";
      case "navbar":
      default:
        return "navbar";
    }
  } else {
    const { navbar } = websiteNavigationConfig(project);
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

export function websiteSearchIncludeInHeader(project: ProjectContext) {
  // Generates a script tag that contains the options for configuring search
  // which is ready in quarto-search.js
  const websiteSearchScript = sessionTempFile({ suffix: "html" });
  const options = searchOptions(project);
  const searchOptionsJson = JSON.stringify(options, null, 2);
  const searchOptionsScript =
    `<script id="quarto-search-options" type="application/json">${searchOptionsJson}</script>`;
  const includes = [searchOptionsScript];

  if (options) {
    const algoliaOpts = options[kAlgolia];
    if (algoliaOpts) {
      includes.push(kAlogioSearchApiScript);
      if (algoliaOpts[kAnalyticsEvents]) {
        const cookieConsent = cookieConsentEnabled(project);
        includes.push(algoliaSearchInsightsScript(cookieConsent));
        includes.push(autocompleteInsightsPluginScript(cookieConsent));
      }
    }
  }

  Deno.writeTextFileSync(websiteSearchScript, includes.join("\n"));
  return websiteSearchScript;
}

export function websiteSearchDependency(
  project: ProjectContext,
  source: string,
): FormatDependency[] {
  const searchDependencies: FormatDependency[] = [];
  const options = searchOptions(project);
  if (options) {
    const sourceRelative = relative(project.dir, source);
    const offset = projectOffset(project, source);
    const href = inputFileHref(sourceRelative);

    const scripts = [
      searchDependency("autocomplete.umd.js"),
      searchDependency("fuse.min.js"),
      searchDependency("quarto-search.js"),
    ];

    // If there are Algolia options specified, check that they are complete
    // and add the algolia search dependency
    const algoliaOpts = options[kAlgolia];
    if (algoliaOpts) {
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

      // See limit imposed at
      // https://www.algolia.com/doc/rest-api/insights/#method-param-objectids
      const limit = options[kLimit];
      if (limit) {
        if (typeof (limit) === "number" && limit > 20) {
          warning(
            "Algolia Insights is limited to 20 objectIds when recording the `Items Viewed` event. Please reduce the limit for your search to avoid a truncated event.",
          );
        }
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
