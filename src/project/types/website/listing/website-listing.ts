/*
* website-listing
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename } from "path/mod.ts";
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  Format,
  FormatDependency,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
} from "../../../../config/types.ts";
import { ProjectContext } from "../../../types.ts";
import {
  createMarkdownPipeline,
  MarkdownPipelineHandler,
} from "../website-pipeline-md.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { kIncludeInHeader } from "../../../../config/constants.ts";
import { sessionTempFile } from "../../../../core/temp.ts";
import { sassLayer } from "../../../../core/sass.ts";
import { kBootstrapDependencyName } from "../../../../format/html/format-html-shared.ts";
import { Listing, ListingItem, ListingType } from "./website-listing-shared.ts";
import {
  templateJsScript,
  templateMarkdownHandler,
} from "./website-listing-template.ts";
import { resolveListings } from "./website-listing-resolve.ts";

export async function listingHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  _extras: FormatExtras,
) {
  // Read and resolve listings from the metadata
  const resolvedListings = await resolveListings(source, project, format);

  // If there no listings, don't inject the dependencies
  if (resolvedListings.length === 0) {
    return undefined;
  }

  // Create the markdown pipeline for this set of listings
  const markdownHandlers: MarkdownPipelineHandler[] = [];
  resolvedListings.forEach((listingItem) => {
    markdownHandlers.push(
      markdownHandler(
        format,
        listingItem.listing,
        listingItem.items,
      ),
    );
  });
  const pipeline = createMarkdownPipeline(
    `quarto-listing-pipeline`,
    markdownHandlers,
  );

  // Add the list.js dependency
  const kListingDependency = "quarto-listing";
  const jsPaths = [
    resourcePath("projects/website/listing/list.min.js"),
  ];
  const htmlDependencies: FormatDependency[] = [{
    name: kListingDependency,
    scripts: jsPaths.map((path) => {
      return {
        name: basename(path),
        path,
      };
    }),
  }];

  // Generate the inline script tags that configure list.js
  const scripts = resolvedListings.map((listingItem) => {
    return templateJsScript(
      listingItem.listing.id,
      listingItem.listing,
      listingItem.items.length,
    );
  });

  // Create the post processor
  const listingPostProcessor = (doc: Document) => {
    // Process the rendered listings into the document
    pipeline.processRenderedMarkdown(doc);

    // Do any other processing of the document
    listingPostProcess(
      doc,
      resolvedListings.map((resolvedListing) => {
        return resolvedListing.listing;
      }),
    );

    // No resource references to add
    return Promise.resolve([]);
  };

  return {
    [kIncludeInHeader]: [scriptFileForScripts(scripts)],
    [kHtmlPostprocessors]: listingPostProcessor,
    [kMarkdownAfterBody]: pipeline.markdownAfterBody(),
    [kDependencies]: htmlDependencies,
    [kSassBundles]: [listingSassBundle()],
  };
}

function markdownHandler(
  format: Format,
  listing: Listing,
  items: ListingItem[],
) {
  switch (listing.type) {
    case ListingType.Table: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-table.ejs.md",
        listing,
        items,
        format,
      );
    }
    case ListingType.Grid: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-grid.ejs.md",
        listing,
        items,
        format,
        {
          style: "--bs-gap: 1em;",
        },
      );
    }
    case ListingType.Default:
    default: {
      return templateMarkdownHandler(
        "projects/website/listing/listing-default.ejs.md",
        listing,
        items,
        format,
      );
    }
  }
}

function listingPostProcess(doc: Document, listings: Listing[]) {
  // Check for whether this page had sidebars and choose column as appropriate
  const defaultColumn = suggestColumn(doc);

  // Move each listing to the correct column
  let titleColumn: string | undefined = undefined;
  listings.forEach((listing) => {
    const userColumn = listing[kPageColumn] as string;
    const targetColumn = userColumn ? `column-${userColumn}` : defaultColumn;
    if (titleColumn === undefined) {
      titleColumn = targetColumn;
    }

    const listingDiv = doc.getElementById(listing.id);
    if (listingDiv) {
      listingDiv.classList.add(targetColumn);
    }
  });

  // Move the title element to the correct column
  const titleEl = doc.getElementById("title-block-header");
  if (titleEl) {
    titleEl.classList.add(titleColumn || defaultColumn);
  }
}

const kPageColumn = "page-column";
const kSidebarId = "quarto-sidebar";
const kMarginSidebarId = "quarto-margin-sidebar";

// Suggests a default column by inspecting sidebars
// if there are none or some, take up the extra space!
function suggestColumn(doc: Document) {
  const leftSidebar = doc.getElementById(kSidebarId);
  const rightSidebar = doc.getElementById(kMarginSidebarId);
  if (leftSidebar && rightSidebar) {
    return "column-body";
  } else if (leftSidebar && leftSidebar.innerText.trim() !== "") {
    return "column-page-right";
  } else if (rightSidebar && rightSidebar.innerText.trim() !== "") {
    return "columm-page-left";
  } else {
    return "column-page";
  }
}

function scriptFileForScripts(scripts: string[]) {
  const scriptFile = sessionTempFile({ suffix: ".html" });
  const contents = `<script>\n${scripts.join("\n")}</script>`;
  Deno.writeTextFileSync(scriptFile, contents);
  return scriptFile;
}

function listingSassBundle() {
  const scssPath = resourcePath("projects/website/listing/quarto-listing.scss");
  const layer = sassLayer(scssPath);
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      name: "quarto-listing.css",
      ...layer,
    },
  };
}
