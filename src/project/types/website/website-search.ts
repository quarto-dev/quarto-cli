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

// The main search key
const kSearch = "search";

// The user facing options
// Should the search input appear on the sidebar or the navbar
const kLocation = "location";
// Show a copy button to copy the search url to the clipboard
const kCopyLink = "copy-link";
// Collapse sections of the same documents when showing them in the results
const kCollapseMatches = "collapse-matches";
// Where to place the search results
const kPanelPlacement = "panel-placement";
const kType = "type";

interface SearchOptions {
  [kLocation]: SearchInputLocation;
  [kCopyLink]: boolean;
  [kCollapseMatches]: boolean | number;
  [kPanelPlacement]: "start" | "end" | "full-width" | "input-wrapper-width";
  [kType]: "input" | "collapsed" | "detached";
}

export type SearchInputLocation = "none" | "navbar" | "sidebar";

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
  let searchJsonRestructured = false;
  const searchDocs = new Array<SearchDoc>();
  if (incremental && searchJson) {
    // Read the existing index
    // Older versions of Quarto used to store just a simple array of search docs
    // Newer versions moved this into an object property so additional options could
    // be passed along as well
    const existingSearchJson = JSON.parse(searchJson);
    if (Array.isArray(existingSearchJson)) {
      searchDocs.push(...(existingSearchJson as SearchDoc[]));
      searchJsonRestructured = true;
    } else if (existingSearchJson.docs) {
      searchDocs.push(...(existingSearchJson.docs as SearchDoc[]));
    }
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
  if (updatedSearchDocs.length > 0 || searchJsonRestructured) {
    const searchData = {
      docs: updatedSearchDocs,
      options: searchOptions(context),
    };

    const updatedSearchJson = JSON.stringify(searchData, undefined, 2);
    if (searchJson !== updatedSearchJson) {
      Deno.writeTextFileSync(searchJsonPath, updatedSearchJson);
    }
  }
}

export function searchOptions(project: ProjectContext): SearchOptions {
  const searchConfig = websiteConfig(kSearch, project.config);

  // The location of the search input
  const location = searchInputLocation(project);

  if (searchConfig && typeof (searchConfig) === "object") {
    // Sort out collapsing (by default, show 2 sections per document)
    const collapseMatches: number | boolean =
      typeof (searchConfig[kCollapseMatches]) === "number"
        ? searchConfig[kCollapseMatches] as number
        : searchConfig[kCollapseMatches] !== false
        ? 2
        : false;

    // The appearance of the search UI
    const searchType = (
      userType: unknown,
    ): "detached" | "collapsed" | "input" => {
      if (userType && typeof (userType) === "string") {
        switch (userType) {
          case "detached":
            return "detached";
          case "collapsed":
            return "collapsed";
          default:
          case "input":
            return "input";
        }
      } else {
        return "input";
      }
    };

    return {
      [kLocation]: location,
      [kCopyLink]: searchConfig[kCopyLink] === true,
      [kCollapseMatches]: collapseMatches,
      [kPanelPlacement]: location === "navbar" ? "end" : "start",
      [kType]: searchType(searchConfig[kType]),
    };
  } else {
    return {
      [kLocation]: location,
      [kCopyLink]: false,
      [kCollapseMatches]: 2,
      [kPanelPlacement]: location === "navbar" ? "end" : "start",
      [kType]: "input",
    };
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
      case "navbar":
        return "navbar";
      case "sidebar":
        return "sidebar";
      default:
        return "none";
    }
  } else if (searchConfig === undefined || searchConfig) {
    const { navbar, sidebars } = websiteNavigationConfig(project);
    if (navbar) {
      return "navbar";
    } else if (sidebars) {
      return "sidebar";
    } else {
      return "none";
    }
  } else {
    return "none";
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

export function websiteSearchDependency(
  project: ProjectContext,
  source: string,
): FormatDependency[] {
  const searchDependencies: FormatDependency[] = [];
  if (searchInputLocation(project) !== "none") {
    const sourceRelative = relative(project.dir, source);
    const offset = projectOffset(project, source);
    const href = inputFileHref(sourceRelative);

    searchDependencies.push(clipboardDependency());
    searchDependencies.push({
      name: kDependencyName,
      meta: {
        "quarto:offset": href === "/404.html"
          ? websitePath(project.config)
          : offset + "/",
      },
      stylesheets: [],
      scripts: [
        searchDependency("autocomplete.min.js"),
        searchDependency("fuse.min.js"),
        searchDependency("quarto-search.js"),
      ],
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
