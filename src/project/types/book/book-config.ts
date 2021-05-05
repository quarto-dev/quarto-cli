/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { join } from "path/mod.ts";

import { safeExistsSync } from "../../../core/path.ts";

import { Metadata } from "../../../config/metadata.ts";

import { fileExecutionEngine } from "../../../execute/engine.ts";

import {
  normalizeSidebarItem,
  partitionedMarkdownForInput,
  SidebarItem,
} from "../../project-config.ts";
import { kProjectRender, ProjectConfig } from "../../project-context.ts";

import {
  kContents,
  kSite,
  kSiteBaseUrl,
  kSiteNavbar,
  kSitePageNavigation,
  kSiteSidebar,
  kSiteTitle,
  websiteProjectConfig,
} from "../website/website-config.ts";

import { isNumberedChapter } from "./book-chapters.ts";

const kAppendicesSectionLabel = "Appendices";

export const kBook = "book";
export const kBookContents = "contents";
export const kBookAppendix = "appendix";
export const kBookReferences = "references";
export const kBookRender = "render";
export const kBookOutputFile = "output-file";

export type BookConfigKey =
  | "output-file"
  | "contents"
  | "references"
  | "appendix"
  | "render"
  | "title"
  | "subtitle"
  | "author"
  | "date"
  | "abstract";

export async function bookProjectConfig(
  projectDir: string,
  config: ProjectConfig,
) {
  // inherit website config behavior
  config = await websiteProjectConfig(projectDir, config);

  // ensure we have a site
  const site = (config[kSite] || {}) as Record<string, unknown>;
  config[kSite] = site;

  // copy some book config into site
  const book = config[kBook] as Record<string, unknown>;
  if (book) {
    site[kSiteTitle] = book[kSiteTitle];
    site[kSiteBaseUrl] = book[kSiteBaseUrl];
    site[kSiteNavbar] = book[kSiteNavbar];
    site[kSiteSidebar] = book[kSiteSidebar];
    site[kSitePageNavigation] = book[kSitePageNavigation] !== false;
  }

  // if we have a top-level 'contents' or 'appendix' fields fold into sidebar
  site[kSiteSidebar] = site[kSiteSidebar] || {};
  const siteSidebar = site[kSiteSidebar] as Metadata;
  siteSidebar[kContents] = [];
  const bookContents = bookConfig(kBookContents, config);

  if (Array.isArray(bookContents)) {
    siteSidebar[kContents] = bookContents;
  }
  const bookReferences = bookConfig(kBookReferences, config);
  if (bookReferences) {
    (siteSidebar[kContents] as unknown[]).push(bookReferences);
  }
  const bookAppendix = bookConfig(kBookAppendix, config);
  if (Array.isArray(bookAppendix)) {
    siteSidebar[kContents] = (siteSidebar[kContents] as unknown[])
      .concat([{
        section: kAppendicesSectionLabel,
        contents: bookAppendix,
      }]);
  }

  // save our own render list (which has more fine grained info about parts,
  // appendices, numbering, etc.) and popuplate the main config render list
  const renderItems = await bookRenderItems(projectDir, config);
  book[kBookRender] = renderItems;
  config.project[kProjectRender] = renderItems
    .filter((target) => !!target.file)
    .map((target) => target.file!);

  // return config
  return config;
}

export function bookConfig(
  name: BookConfigKey,
  project?: ProjectConfig,
) {
  const book = project?.[kBook] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    return book[name] as
      | Array<unknown>
      | Record<string, unknown>
      | string
      | undefined;
  } else {
    return undefined;
  }
}

export function bookConfigRenderItems(
  project?: ProjectConfig,
): BookRenderItem[] {
  return bookConfig(
    kBookRender,
    project,
  ) as BookRenderItem[];
}

export function isBookIndexPage(target: BookRenderItem): boolean;
export function isBookIndexPage(target: string): boolean;
export function isBookIndexPage(target: string | BookRenderItem): boolean {
  if (typeof (target) !== "string") {
    return target.type == "index";
  } else {
    return target.startsWith("index.");
  }
}

export type BookRenderItemType = "index" | "chapter" | "appendix" | "part";

export interface BookRenderItem {
  type: BookRenderItemType;
  text?: string;
  file?: string;
  number?: number;
}

export async function bookRenderItems(
  projectDir: string,
  config?: ProjectConfig,
): Promise<BookRenderItem[]> {
  if (!config) {
    return [];
  }

  let nextNumber = 1;
  const inputs: BookRenderItem[] = [];

  const findInputs = async (
    type: BookRenderItemType,
    items: SidebarItem[],
  ) => {
    for (const item of items) {
      if (item.contents) {
        inputs.push({
          type: "part",
          file: item.href,
          text: item.text,
        });
        await findInputs(type, item.contents);
      } else if (item.href) {
        const itemPath = join(projectDir, item.href);
        if (safeExistsSync(itemPath)) {
          const engine = fileExecutionEngine(itemPath, true);
          if (engine) {
            // set index type if appropriate
            const itemType = isBookIndexPage(item.href) ? "index" : type;

            // for chapters, check if we are numbered
            let number: number | undefined;

            if (
              itemType === "chapter" &&
              await inputIsNumbered(projectDir, item.href)
            ) {
              number = nextNumber++;
            }

            // add the input
            inputs.push({
              type: itemType,
              file: item.href,
              number,
            });
          }
        }
      }
    }
  };

  const findChapters = async (
    key: "contents" | "appendix",
    delimiter?: BookRenderItem,
  ) => {
    nextNumber = 1;
    const bookInputs = bookConfig(key, config) as
      | Array<unknown>
      | undefined;
    if (bookInputs) {
      if (delimiter) {
        inputs.push(delimiter);
      }
      await findInputs(
        "chapter",
        bookInputs.map((item) =>
          normalizeSidebarItem(projectDir, item as SidebarItem)
        ),
      );
    }
  };

  await findChapters("contents");

  const references = bookConfig("references", config);
  if (references) {
    await findInputs("chapter", [
      normalizeSidebarItem(projectDir, references as SidebarItem),
    ]);
  }

  await findChapters(kBookAppendix, {
    type: "appendix",
    text: kAppendicesSectionLabel,
  });

  // validate that all of the chapters exist
  const missing = inputs.filter((input) =>
    input.file && !existsSync(join(projectDir, input.file))
  );
  if (missing.length) {
    throw new Error(
      "Book contents file(s) do not exist: " + missing.join(", "),
    );
  }

  // find the index and place it at the front (error if no index)
  const indexPos = inputs.findIndex(isBookIndexPage);
  if (indexPos === -1) {
    throw new Error(
      "Book contents must include a home page (e.g. index.md)",
    );
  }
  const index = inputs.splice(indexPos, 1);
  return index.concat(inputs);
}

async function inputIsNumbered(
  projectDir: string,
  input: string,
) {
  const partitioned = await partitionedMarkdownForInput(projectDir, input);
  if (partitioned) {
    return isNumberedChapter(partitioned);
  } else {
    return false;
  }
}
