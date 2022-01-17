/*
* website-listing
.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename } from "path/mod.ts";
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import { existsSync } from "fs/mod.ts";

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
import { sassLayer } from "../../../../core/sass.ts";
import { kBootstrapDependencyName } from "../../../../format/html/format-html-shared.ts";
import {
  Listing,
  ListingDescriptor,
  ListingItem,
  ListingType,
} from "./website-listing-shared.ts";
import {
  templateJsScript,
  templateMarkdownHandler,
} from "./website-listing-template.ts";
import { readListings } from "./website-listing-read.ts";
import { categorySidebar } from "./website-listing-categories.ts";
import { TempContext } from "../../../../core/temp.ts";

export async function listingHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  temp: TempContext,
  _extras: FormatExtras,
) {
  // Read and resolve listings from the metadata
  const listingDescriptors = await readListings(source, project, format);

  // If there no listings, don't inject the dependencies
  if (listingDescriptors.length === 0) {
    return undefined;
  }

  // Create the markdown pipeline for this set of listings
  const markdownHandlers: MarkdownPipelineHandler[] = [];
  listingDescriptors.forEach((listingDescriptor) => {
    markdownHandlers.push(
      markdownHandler(
        format,
        listingDescriptor.listing,
        listingDescriptor.items,
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
    resourcePath("projects/website/listing/quarto-listing.js"),
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
  const scripts = listingDescriptors.map((listingItem) => {
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
      listingDescriptors,
    );

    // No resource references to add
    return Promise.resolve([]);
  };

  return {
    [kIncludeInHeader]: [scriptFileForScripts(scripts, temp)],
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
        resourcePath("projects/website/listing/listing-table.ejs.md"),
        listing,
        items,
        format,
      );
    }
    case ListingType.Grid: {
      return templateMarkdownHandler(
        resourcePath("projects/website/listing/listing-grid.ejs.md"),
        listing,
        items,
        format,
        {
          style: "--bs-gap: 1em;",
        },
      );
    }
    case ListingType.Custom: {
      if (listing.template === undefined) {
        throw new Error(
          "In order to use a listing of type custom, please provide the path to a template.",
        );
      } else {
        if (!existsSync(listing.template)) {
          throw new Error(
            `The template ${listing.template} can't be found.`,
          );
        }
      }
      return templateMarkdownHandler(
        listing.template,
        listing,
        items,
        format,
      );
    }
    case ListingType.Default:
    default: {
      return templateMarkdownHandler(
        resourcePath("projects/website/listing/listing-default.ejs.md"),
        listing,
        items,
        format,
      );
    }
  }
}

function listingPostProcess(
  doc: Document,
  listingDescriptors: ListingDescriptor[],
) {
  const { headingEl, categoriesEl } = categorySidebar(doc, listingDescriptors);
  const rightSidebar = doc.getElementById(kMarginSidebarId);
  rightSidebar?.appendChild(headingEl);
  rightSidebar?.appendChild(categoriesEl);

  // Check for whether this page had sidebars and choose column as appropriate
  const defaultColumn = suggestColumn(doc);
  console.log(defaultColumn);

  // Move each listing to the correct column
  let titleColumn: string | undefined = undefined;
  listingDescriptors.forEach((listingDescriptor) => {
    const userColumn = listingDescriptor.listing[kPageColumn] as string;
    const targetColumn = userColumn ? `column-${userColumn}` : defaultColumn;
    if (titleColumn === undefined) {
      titleColumn = targetColumn;
    }
  });

  // Move the main content element to the correct column
  const mainEl = doc.querySelector("main.content");
  if (mainEl) {
    mainEl.classList.add(titleColumn || defaultColumn);
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

function scriptFileForScripts(scripts: string[], temp: TempContext) {
  const scriptFile = temp.createFile({ suffix: "html" });
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
