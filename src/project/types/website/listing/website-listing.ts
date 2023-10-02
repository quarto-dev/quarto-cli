/*
* website-listing
.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { basename, dirname, join, relative } from "path/mod.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
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
} from "../../../../core/markdown-pipeline.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { kIncludeInHeader } from "../../../../config/constants.ts";
import { sassLayer } from "../../../../core/sass.ts";
import {
  kBootstrapDependencyName,
} from "../../../../format/html/format-html-shared.ts";
import {
  kFeed,
  kFieldCategories,
  Listing,
  ListingDescriptor,
  ListingFeedOptions,
  ListingItem,
  ListingSharedOptions,
  ListingType,
} from "./website-listing-shared.ts";
import {
  templateJsScript,
  templateMarkdownHandler,
} from "./website-listing-template.ts";
import { completeListingItems, readListings } from "./website-listing-read.ts";
import { categorySidebar } from "./website-listing-categories.ts";
import { TempContext } from "../../../../core/temp.ts";
import { completeStagedFeeds, createFeed } from "./website-listing-feed.ts";
import {
  HtmlPostProcessResult,
  RenderFile,
} from "../../../../command/render/types.ts";
import {
  cacheListingProjectData,
  clearListingProjectData,
  listingProjectData,
} from "./website-listing-project.ts";
import { filterPaths } from "../../../../core/path.ts";
import { uniqBy } from "../../../../core/lodash.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { touch } from "../../../../core/file.ts";
import {
  createListingIndex,
  updateGlobalListingIndex,
} from "./website-listing-index.ts";
import { ProjectOutputFile } from "../../types.ts";
import { formatHasBootstrap } from "../../../../format/html/format-html-info.ts";
import { debug } from "https://deno.land/std@0.185.0/log/mod.ts";

export function listingSupplementalFiles(
  project: ProjectContext,
  inputs: RenderFile[],
  incremental: boolean,
) {
  if (incremental) {
    // This is incremental, so use the cache to supplement
    // any listing pages that would contain any of the
    // files being rendered
    const listingProjData = listingProjectData(project);
    const listingMap = listingProjData.listingMap || {};

    const listingFiles = Object.keys(listingMap);
    const inputPaths = inputs.map((inp) => inp.path);

    // For each listing, rerun the globs in contents
    // against the rendered file list. If a glob matches
    // we should render that listing file, because that means
    // the file being rendered is included (or is a new file that will)
    // be included in the listing page.
    const matching = listingFiles.filter((listingFile) => {
      const listingDir = join(project.dir, dirname(listingFile));
      const globs = listingMap[listingFile];
      if (filterPaths(listingDir, inputPaths, globs).include.length > 0) {
        return true;
      }
    });

    if (matching.length > 0) {
      const supplementalFiles = matching.map((listingRelativePath) => {
        return join(project.dir, listingRelativePath);
      });
      const files = uniqBy(supplementalFiles.filter((file) => {
        return !inputs.find((inp) => {
          return inp.path === file;
        }) && existsSync(file);
      }));

      const onRenderComplete = async (
        project: ProjectContext,
        files: string[],
        incremental: boolean,
      ) => {
        if (incremental) {
          const outputDir = projectOutputDir(project);
          for (const file of files) {
            const filePath = join(outputDir, file);
            // Touching the non-supplemental files ensures that
            // any file modified events for those files will happen
            // after the listing file events (for quarto preview, for example)
            await touch(filePath);
          }
        }
      };

      return {
        files: files.map((file) => {
          return { path: file, formats: ["html", "html4", "html5"] };
        }),
        onRenderComplete,
      };
    } else {
      return { files: [] };
    }
  } else {
    // This is a full render, clear the cache
    // (a brute force form of garbage collection)
    clearListingProjectData(project);
    return { files: [] };
  }
}

export async function listingHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  temp: TempContext,
  _extras: FormatExtras,
) {
  // Read and resolve listings from the metadata
  const { listingDescriptors, options } = await readListings(
    source,
    project,
    format,
  );

  // If there no listings, don't inject the dependencies
  const pageHasListings = listingDescriptors.length > 0;

  // Record the rendering of this listing in our 'listing cache'
  if (pageHasListings) {
    cacheListingProjectData(
      project,
      relative(project.dir, source),
      listingDescriptors,
    );
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

  // This force math dependencies to be injected into the page.
  markdownHandlers.push({
    getUnrendered: () => {
      return {
        inlines: {
          "quarto-enable-math-inline": "$e = mC^2$",
        },
      };
    },
    processRendered: (_rendered: Record<string, Element>, _doc: Document) => {
    },
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
  const listingDependencies: FormatDependency[] = [{
    name: kListingDependency,
    scripts: jsPaths.map((path) => {
      return {
        name: basename(path),
        path,
      };
    }),
  }];

  // Generate the inline script tags that configure list.js
  const generateScriptListJsScript = () => {
    return listingDescriptors.map((listingItem) => {
      return templateJsScript(
        listingItem.listing.id,
        listingItem.listing,
        listingItem.items.length,
      );
    });
  };

  // Create the post processor
  const listingPostProcessor = async (
    doc: Document,
  ): Promise<HtmlPostProcessResult> => {
    // Process the rendered listings into the document
    pipeline.processRenderedMarkdown(doc);

    // Do any other processing of the document
    listingPostProcess(
      doc,
      listingDescriptors,
      options,
      format,
    );

    const supporting: string[] = [];
    if (options[kFeed]) {
      const listingOptions = {
        type: "full",
        ...(options[kFeed] as unknown as Record<string, unknown>),
      } as ListingFeedOptions;

      const feedAbsPaths = await createFeed(
        doc,
        source,
        project,
        listingDescriptors,
        listingOptions,
        format,
      );
      if (feedAbsPaths) {
        feedAbsPaths.forEach((feedAbsPath) => {
          supporting.push(feedAbsPath);
        });
      }
    }

    // Write the index of entries in this listing
    const listingIndexPath = await createListingIndex(
      source,
      project,
      listingDescriptors,
    );
    if (listingIndexPath) {
      supporting.push(listingIndexPath);
    }

    // No resource references to add
    return Promise.resolve({ resources: [], supporting });
  };

  return {
    [kSassBundles]: formatHasBootstrap(format) ? [listingSassBundle()] : [],
    [kDependencies]: pageHasListings ? listingDependencies : [],
    [kMarkdownAfterBody]: pageHasListings
      ? pipeline.markdownAfterBody()
      : undefined,
    [kIncludeInHeader]: pageHasListings
      ? [
        scriptFileForScripts(generateScriptListJsScript(), temp),
      ]
      : [],
    [kHtmlPostprocessors]: pageHasListings ? listingPostProcessor : undefined,
  };
}

export function completeListingGeneration(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  // Complete any staged feeds
  debug(`[listing] Completing staged feeds in ${context.dir}`);
  completeStagedFeeds(context, outputFiles, incremental);

  // Ensure any listing items have their rendered descriptions populated
  debug(`[listing] Completing listing items in ${context.dir}`);
  completeListingItems(context, outputFiles, incremental);

  // Write a global listing index
  debug(`[listing] Writing global listing index for ${context.dir}`);
  updateGlobalListingIndex(context, outputFiles, incremental);
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
        true,
      );
    }
    case ListingType.Grid: {
      return templateMarkdownHandler(
        resourcePath("projects/website/listing/listing-grid.ejs.md"),
        listing,
        items,
        format,
        true,
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
        false,
      );
    }
    case ListingType.Default:
    default: {
      return templateMarkdownHandler(
        resourcePath("projects/website/listing/listing-default.ejs.md"),
        listing,
        items,
        format,
        true,
      );
    }
  }
}

function listingPostProcess(
  doc: Document,
  listingDescriptors: ListingDescriptor[],
  options: ListingSharedOptions,
  format: Format,
) {
  debug(`[listing] Post processing ${listingDescriptors.length} listings`);
  // Render categories, if necessary
  const categories = options[kFieldCategories];
  if (categories) {
    const { headingEl, categoriesEl } = categorySidebar(
      doc,
      listingDescriptors,
      format,
      options,
    );
    const rightSidebar = doc.getElementById(kMarginSidebarId);

    // See if there are contents in the sidebar, and place the categories
    // just after the header or before the footer
    const marginHeader = rightSidebar?.querySelector(".quarto-margin-header");
    if (marginHeader) {
      marginHeader.after(...[headingEl, categoriesEl]);
    } else {
      const marginFooter = rightSidebar?.querySelector(".quarto-margin-footer");
      if (marginFooter) {
        rightSidebar?.insertBefore(headingEl, marginFooter);
        rightSidebar?.insertBefore(categoriesEl, marginFooter);
      } else {
        rightSidebar?.appendChild(headingEl);
        rightSidebar?.appendChild(categoriesEl);
      }
    }
  }

  // Purge any images that made it into the description
  const descImgs = doc.querySelectorAll(".listing-description img");
  descImgs.forEach((descImg) => {
    (descImg as Element).remove();
  });
}

const kMarginSidebarId = "quarto-margin-sidebar";

function scriptFileForScripts(scripts: string[], temp: TempContext) {
  const scriptFile = temp.createFile({ suffix: "-listing.html" });
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
