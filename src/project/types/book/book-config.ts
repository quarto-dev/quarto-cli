/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { join } from "path/mod.ts";

import { dirAndStem, safeExistsSync } from "../../../core/path.ts";

import { Metadata } from "../../../config/metadata.ts";
import { kTitle } from "../../../config/constants.ts";

import { fileExecutionEngine } from "../../../execute/engine.ts";

import { normalizeSidebarItem, SidebarItem } from "../../project-config.ts";
import { kProjectRender, ProjectConfig } from "../../project-context.ts";

import {
  kContents,
  kSiteSidebar,
  kSiteTitle,
} from "../website/website-config.ts";

export const kBookContents = "book-contents";

export async function bookProjectConfig(
  projectDir: string,
  config: ProjectConfig,
) {
  // clone and make sure we have a project entry
  config = ld.cloneDeep(config);

  // ensure we have a sidebar
  config[kSiteSidebar] = config[kSiteSidebar] || {};

  // if we have a top-level 'contents' then fold it into sidebar
  if (config[kBookContents]) {
    (config[kSiteSidebar] as Metadata)[kContents] = config[kBookContents];
    delete config[kBookContents];
  }

  // create render list from 'contents'
  config[kProjectRender] = bookRenderList(projectDir, config);

  // some special handling for the index file / preface
  const indexFile = (config[kProjectRender] || []).find((file) => {
    const [dir, stem] = dirAndStem(file);
    return dir === "." && stem === "index";
  });
  if (indexFile) {
    // derive website title from index file 'title'
    const indexFilePath = join(projectDir, indexFile);
    const engine = fileExecutionEngine(indexFilePath);
    if (engine) {
      const metadata = await engine.metadata(indexFilePath);
      const title = metadata[kTitle];
      if (title) {
        config[kSiteTitle] = title;
      }
    }
  }

  // return config
  return config;
}

function bookRenderList(projectDir: string, config: ProjectConfig) {
  // determine contents
  const contents: SidebarItem[] = [];
  if (config[kSiteSidebar]) {
    const sidebar = config[kSiteSidebar] as Record<string, unknown>;
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

    return inputs;
  } else {
    return [];
  }
}
