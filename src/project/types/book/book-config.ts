/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { join } from "path/mod.ts";

import { safeExistsSync } from "../../../core/path.ts";

import { Metadata } from "../../../config/metadata.ts";

import { fileExecutionEngine } from "../../../execute/engine.ts";

import { normalizeSidebarItem, SidebarItem } from "../../project-config.ts";
import { ProjectConfig } from "../../project-context.ts";

import { kSidebar } from "../website/website-navigation.ts";

export const kContents = "contents";

export function bookProjectConfig(projectDir: string, config: ProjectConfig) {
  // clone and make sure we have a project entry
  config = ld.cloneDeep(config);
  config.project = config.project || {};

  // ensure we have a nav-side
  config[kSidebar] = config[kSidebar] || {};

  // if we have a top-level 'contents' then fold it into nav-side
  if (config[kContents]) {
    (config[kSidebar] as Metadata)[kContents] = config[kContents];
    delete config[kContents];
  }

  // create render list from 'contents'
  config.project.render = bookRenderList(projectDir, config);

  // return config
  return config;
}

function bookRenderList(projectDir: string, config: ProjectConfig) {
  // determine contents
  const contents: SidebarItem[] = [];
  if (config[kSidebar]) {
    const sidebar = config[kSidebar] as Record<string, unknown>;
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
            index === "href" && typeof (value) === "string" &&
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
