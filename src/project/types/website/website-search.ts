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

// Any aloglia configuration
const kAlgolia = "algolia";

interface SearchOptions {
  [kLocation]: SearchInputLocation;
  [kCopyButton]: boolean;
  [kCollapseAfter]: boolean | number;
  [kType]: "textbox" | "overlay";
  [kPanelPlacement]: "start" | "end" | "full-width" | "input-wrapper-width";
  [kAlgolia]?: SearchOptionsAlgolia;
}

const kSearchOnlyApiKey = "search-only-api-key";
const kSearchApplicationId = "application-id";
const kSearchParams = "params";
const kSearchIndexName = "index-name";
interface SearchOptionsAlgolia {
  [kSearchOnlyApiKey]?: string;
  [kSearchApplicationId]?: string;
  [kSearchIndexName]?: string;
  [kSearchParams]?: Record<string, unknown>;
}

export type SearchInputLocation = "navbar" | "sidebar";

interface SearchDoc {
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

      // if there are level 2 sections then create sub-docs for them
      const sections = doc.querySelectorAll("section.level2");
      if (sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i] as Element;
          const h2 = section.querySelector("h2");
          if (h2 && section.id) {
            const sectionTitle = h2.textContent;
            h2.remove();
            updateDoc({
              href: `${href}#${section.id}`,
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
    };
  }
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
    return {
      [kSearchApplicationId]: applicationId,
      [kSearchOnlyApiKey]: apiKey,
      [kSearchIndexName]: indexName,
      [kSearchParams]: params,
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
  const scriptHtml =
    `<script id="quarto-search-options" type="application/json">${searchOptionsJson}</script>`;
  Deno.writeTextFileSync(websiteSearchScript, scriptHtml);
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

    // If there are Algoia options specified, check that they are complete
    // and add the algolia search dependency
    const algoliaOpts = options[kAlgolia];
    if (algoliaOpts) {
      if (
        algoliaOpts[kSearchApplicationId] &&
        algoliaOpts[kSearchOnlyApiKey] &&
        algoliaOpts[kSearchIndexName]
      ) {
        scripts.push(searchDependency("algoliasearch-lite.umd.js"));
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
