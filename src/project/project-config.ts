/*
 * project-config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";

import * as ld from "../core/lodash.ts";

import { safeExistsSync } from "../core/path.ts";

import { readInputTargetIndex } from "./project-index.ts";
import { fileExecutionEngine } from "../execute/engine.ts";
import { SidebarItem } from "./types.ts";

export type SidebarContext = {
  counter: number;
  itemCounter: number;
};

export const sidebarContext = (): SidebarContext => {
  return { counter: 0, itemCounter: 0 };
};

export function normalizeSidebarItem(
  projectDir: string,
  item: SidebarItem,
  context: SidebarContext,
): SidebarItem {
  // clone so we can mutate
  item = ld.cloneDeep(item);

  if (typeof item === "string") {
    context.itemCounter = context.itemCounter + 1;
    const id = `${kQuartoSidebarItemPrefix}${context.itemCounter}`;

    if (safeExistsSync(join(projectDir, item))) {
      item = {
        href: item,
        id,
      };
    } else {
      item = {
        text: item,
        id,
      };
    }
  } else {
    // resolve aliases for href
    resolveHrefAttribute(item);

    // section is a special key that can provide either text or href
    // for an item with 'contents'
    const section = item.section;
    if (section) {
      // Increment the counter
      context.counter = context.counter + 1;

      const sectionPath = join(projectDir, section);
      if (safeExistsSync(sectionPath) && Deno.statSync(sectionPath).isFile) {
        item.href = section;
      } else {
        item.text = section;
      }
      // The htmlId could be empty, in which case we will not have created
      // an unambiguous sectionId, so don't write the section Id in this
      // case
      item.sectionId = `${kQuartoSidebarPrefix}${context.counter}`;
      delete item.section;

      // If this is a section, we should insist that it have 'contents'
      // even if they are empty.
      item.contents = item.contents || [];
    } else {
      context.itemCounter = context.itemCounter + 1;
      item.id = item.id === undefined
        ? `${kQuartoSidebarItemPrefix}${context.itemCounter}`
        : item.id;
    }

    // handle subitems
    if (item.contents) {
      for (let i = 0; i < item.contents.length; i++) {
        item.contents[i] = normalizeSidebarItem(
          projectDir,
          item.contents[i],
          context,
        );
      }
    }
  }

  return item;
}

const kQuartoSidebarPrefix = "quarto-sidebar-section-";
const kQuartoSidebarItemPrefix = "quarto-sidebar-item-";

export function resolveHrefAttribute(
  item: { href?: string; file?: string; url?: string },
) {
  item.href = item.href || item.file || item.url;
  delete item.file;
  delete item.url;
}

export async function partitionedMarkdownForInput(
  projectDir: string,
  input: string,
) {
  // first see if we can get the partioned markdown out of the index
  const { index } = readInputTargetIndex(projectDir, input);
  if (index) {
    return index.markdown;
    // otherwise fall back to calling the engine to do the partition
  } else {
    const inputPath = join(projectDir, input);
    const engine = fileExecutionEngine(inputPath);
    if (engine) {
      return await engine.partitionedMarkdown(inputPath);
    } else {
      return undefined;
    }
  }
}
