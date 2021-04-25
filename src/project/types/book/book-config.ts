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
  websiteConfig,
} from "../website/website-config.ts";

export const kBook = "book";
export const kBookContents = "contents";

export type BookConfigKey =
  | "contents"
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

  // if we have a top-level 'contents' then fold it into sidebar
  site[kSiteSidebar] = site[kSiteSidebar] || {};
  const bookContents = bookConfig(kBookContents, config);
  if (bookContents) {
    (site[kSiteSidebar] as Metadata)[kContents] = bookContents;
  }

  // create render list from 'contents'
  config.project[kProjectRender] = bookRenderList(projectDir, config);

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

function bookRenderList(projectDir: string, config: ProjectConfig) {
  // determine contents
  const contents: SidebarItem[] = [];
  const sidebar = websiteConfig(kSiteSidebar, config) as Record<
    string,
    unknown
  >;
  if (sidebar) {
    if (sidebar[kContents]) {
      contents.push(...(sidebar[kContents] as SidebarItem[])
        .map((item) => normalizeSidebarItem(projectDir, item)));
    }
  }

  if (contents.length > 0) {
    const inputs: string[] = [];
    const findInputs = (
      collection: Array<unknown> | Record<string, unknown>,
    ) => {
      ld.forEach(
        collection,
        (
          value: unknown,
          index: unknown,
        ) => {
          if (Array.isArray(value)) {
            findInputs(value);
          } else if (typeof (value) === "object") {
            findInputs(value as Record<string, unknown>);
          } else if (
            ((index === "href" || index === "file") &&
              typeof (value) === "string") &&
            safeExistsSync(join(projectDir, value)) &&
            fileExecutionEngine(join(projectDir, value), true)
          ) {
            inputs.push(value);
          }
        },
      );
    };
    findInputs(contents);

    // validate that all of the chapters exist
    const missing = inputs.filter((input) =>
      !existsSync(join(projectDir, input))
    );
    if (missing.length) {
      throw new Error(
        "Book contents file(s) do not exist: " + missing.join(", "),
      );
    }

    // find the index and place it at the front (error if no index)
    const indexPos = inputs.findIndex((input) => input.startsWith("index."));
    if (indexPos === -1) {
      throw new Error(
        "Book contents must include a home page (e.g. index.md)",
      );
    }
    const index = inputs.splice(indexPos, 1);
    return index.concat(inputs);
  } else {
    return [];
  }
}
