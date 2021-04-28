/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { join } from "path/mod.ts";

import { safeExistsSync } from "../../../core/path.ts";

import { Metadata } from "../../../config/metadata.ts";

import { fileExecutionEngine } from "../../../execute/engine.ts";

import { normalizeSidebarItem, SidebarItem } from "../../project-config.ts";
import { kProjectRender, ProjectConfig } from "../../project-context.ts";

import {
  kContents,
  kSite,
  kSiteBaseUrl,
  kSiteNavbar,
  kSiteSidebar,
  kSiteTitle,
} from "../website/website-config.ts";

export const kBook = "book";
export const kBookContents = "contents";
export const kBookAppendix = "appendix";

export type BookConfigKey =
  | "contents"
  | "appendix"
  | "title"
  | "subtitle"
  | "author"
  | "date"
  | "abstract";

export function bookProjectConfig(
  projectDir: string,
  config: ProjectConfig,
) {
  // clone and make sure we have a project entry
  config = ld.cloneDeep(config);

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
  }

  // if we have a top-level 'contents' or 'appendix' fields fold into sidebar
  site[kSiteSidebar] = site[kSiteSidebar] || {};
  const siteSidebar = site[kSiteSidebar] as Metadata;
  const bookContents = bookConfig(kBookContents, config);
  if (Array.isArray(bookContents)) {
    siteSidebar[kContents] = bookContents;
  }
  const bookAppendix = bookConfig(kBookAppendix, config);
  if (Array.isArray(bookAppendix)) {
    siteSidebar[kContents] = (siteSidebar[kContents] as unknown[] || [])
      .concat([{
        section: "Appendix",
        contents: bookAppendix,
      }]);
  }

  // create render list from 'contents'
  const targets = bookItems(projectDir, config);
  config.project[kProjectRender] = targets
    .filter((target) => !!target.file)
    .map((target) => target.file!);

  // return config
  return Promise.resolve(config);
}

export function bookConfig(
  name: BookConfigKey,
  project?: ProjectConfig,
) {
  const book = project?.[kBook] as
    | Record<string, unknown>
    | undefined;
  if (book) {
    return book[name] as Record<string, unknown> | string | undefined;
  } else {
    return undefined;
  }
}

export function isBookIndexPage(target: BookItem): boolean;
export function isBookIndexPage(target: string): boolean;
export function isBookIndexPage(target: string | BookItem): boolean {
  if (typeof (target) !== "string") {
    return target.type == "index";
  } else {
    return target.startsWith("index.");
  }
}

export type BookItemType = "index" | "chapter" | "appendix" | "part";

export interface BookItem {
  type: BookItemType;
  text?: string;
  file?: string;
}

export function bookItems(
  projectDir: string,
  config?: ProjectConfig,
): BookItem[] {
  if (!config) {
    return [];
  }

  const inputs: BookItem[] = [];

  const findInputs = (
    type: BookItemType,
    items: SidebarItem[],
  ) => {
    for (const item of items) {
      if (item.contents) {
        inputs.push({
          type: "part",
          file: item.href,
          text: item.text,
        });
        findInputs(type, item.contents);
      } else if (item.href) {
        if (
          safeExistsSync(join(projectDir, item.href)) &&
          fileExecutionEngine(join(projectDir, item.href), true)
        ) {
          inputs.push({
            type: isBookIndexPage(item.href) ? "index" : type,
            file: item.href,
          });
        }
      }
    }
  };

  const findChapters = (
    key: "contents" | "appendix",
    delimiter?: BookItem,
  ) => {
    const bookInputs = bookConfig(key, config) as
      | Array<unknown>
      | undefined;
    if (bookInputs) {
      if (delimiter) {
        inputs.push(delimiter);
      }
      findInputs(
        "chapter",
        bookInputs.map((item) =>
          normalizeSidebarItem(projectDir, item as SidebarItem)
        ),
      );
    }
  };

  findChapters("contents");
  findChapters("appendix", { type: "appendix", text: "Appendices" });

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
