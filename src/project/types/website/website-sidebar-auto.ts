/*
* website-sidebar-auto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, join, relative } from "path/mod.ts";
import { kOrder } from "../../../config/constants.ts";
import { asNumber } from "../../../core/cast.ts";

import * as ld from "../../../core/lodash.ts";
import {
  dirAndStem,
  filterPaths,
  pathWithForwardSlashes,
  safeExistsSync,
} from "../../../core/path.ts";
import { capitalizeTitle } from "../../../core/text.ts";
import { engineValidExtensions } from "../../../execute/engine.ts";
import {
  inputTargetIndex,
  inputTargetIsEmpty,
  resolveInputTarget,
} from "../../project-index.ts";

import { ProjectContext, SidebarItem } from "../../types.ts";

export async function expandAutoSidebarItems(
  project: ProjectContext,
  items: SidebarItem[],
) {
  items = normalizeSidebarItems(ld.cloneDeep(items));
  const expanded: SidebarItem[] = [];
  for (const item of items) {
    if (item.auto) {
      const autoItems = await sidebarItemsFromAuto(project, item.auto);
      expanded.push(...autoItems);
    } else {
      if (item.contents) {
        item.contents = await expandAutoSidebarItems(project, item.contents);
      }
      expanded.push(item);
    }
  }
  return expanded;
}

// sidebar items (e.g. contents: ) are an array in the type system, however
// contents: auto and contents: auto: true are both valid, which are not
// arrays -- here we fix it all up
function normalizeSidebarItems(items: SidebarItem[]) {
  if (!Array.isArray(items)) {
    if (typeof (items) === "string") {
      if (items === "auto") {
        items = [{ auto: true }];
      } else {
        items = [{ auto: items }];
      }
    } else {
      items = [items as SidebarItem];
    }
  }
  return items;
}

async function sidebarItemsFromAuto(
  project: ProjectContext,
  auto: boolean | string | string[],
): Promise<SidebarItem[]> {
  // list of globs from auto
  const globs: string[] = globsFromAuto(project, auto);

  // scan for inputs and organize them into heirarchical nodes
  const entries: Entry[] = [];
  for (const nodeSet of autoSidebarNodes(project, globs)) {
    entries.push(
      ...await nodesToEntries(
        project,
        `${nodeSet.root ? nodeSet.root + "/" : ""}`,
        nodeSet.nodes,
      ),
    );
  }

  // convert the entries into proper sidebar items
  return sidebarItemsFromEntries(entries.sort(sortEntries));
}

function globsFromAuto(
  project: ProjectContext,
  auto: boolean | string | string[],
) {
  // list of globs from auto
  const globs: string[] = [];
  if (typeof (auto) === "boolean") {
    if (auto === true) {
      globs.push("*");
    }
  } else {
    if (!Array.isArray(auto)) {
      auto = [auto];
    }
    globs.push(...auto.map((glob) => {
      // single directory name that exists means the whole directory
      const target = join(project.dir, glob);
      if (safeExistsSync(target) && Deno.statSync(target).isDirectory) {
        glob = join(glob, "**");
      }
      return glob;
    }));
  }
  return globs;
}

// deno-lint-ignore no-explicit-any
type SidebarNodes = Record<string, any>;
function autoSidebarNodes(
  project: ProjectContext,
  globs: string[],
): { root: string; nodes: Record<string, SidebarNodes> }[] {
  return globs.map((glob) => {
    const inputs = (ld.uniq(
      filterPaths(
        project.dir,
        project.files.input,
        [glob],
        { mode: "always" },
      ).include,
    ) as string[])
      .map((input) => pathWithForwardSlashes(relative(project.dir, input)))
      .filter((input) => !/\/?index\.\w+$/.test(input));

    // is this a directory glob?
    let directory = "";
    const match = glob.match(/(.*?)\/\*.*$/);
    if (match && safeExistsSync(join(project.dir, match[1]))) {
      directory = match[1];
    }

    // split into directory heirarchy
    let result: Record<string, SidebarNodes> = {};
    inputs.forEach((p) =>
      p.split("/").reduce(
        (o, k) => o[k] = o[k] || {},
        result,
      )
    );

    // index into the nodes based on the directory
    if (directory) {
      directory.split("/").forEach((p) => {
        result = result[p];
      });
    }

    // return the root and result
    return {
      root: directory,
      nodes: result,
    };
  });
}

type Entry = {
  title: string;
  href?: string;
  order?: number;
  empty?: boolean;
  children?: Entry[];
};

async function nodesToEntries(
  project: ProjectContext,
  root: string,
  nodes: SidebarNodes,
) {
  const entries: Entry[] = [];

  for (const node of Object.keys(nodes)) {
    const href = `${root}${node}`;
    const path = join(project.dir, href);
    if (safeExistsSync(path)) {
      if (Deno.statSync(path).isDirectory) {
        // use index file if available
        const indexFileExt = engineValidExtensions().find((ext) => {
          return safeExistsSync(join(path, `index${ext}`));
        });
        if (indexFileExt) {
          entries.push({
            ...await entryFromHref(project, join(href, `index${indexFileExt}`)),
            children: await nodesToEntries(
              project,
              `${root}${node}/`,
              nodes[node],
            ),
          });
        } else {
          entries.push({
            title: titleFromPath(href),
            children: await nodesToEntries(
              project,
              `${root}${node}/`,
              nodes[node],
            ),
          });
        }
      } else {
        entries.push(await entryFromHref(project, href));
      }
    }
  }

  // order the entries using 'order' and 'title'
  return entries.sort(sortEntries);
}

function sortEntries(a: Entry, b: Entry) {
  const titleOrder = a.title.toLocaleUpperCase().localeCompare(
    b.title.toLocaleUpperCase(),
  );
  if (a.children && !b.children) {
    return 1;
  } else if (b.children && !a.children) {
    return -1;
  }
  if (a.order !== undefined && b.order !== undefined) {
    const order = a.order - b.order;
    return order !== 0 ? order : titleOrder;
  } else if (a.order !== undefined) {
    return -1;
  } else if (b.order !== undefined) {
    return 1;
  } else {
    return titleOrder;
  }
}

async function entryFromHref(project: ProjectContext, href: string) {
  const index = await inputTargetIndex(project, href);
  return {
    title: index?.title ||
      (await resolveInputTarget(project, href))?.title ||
      titleFromPath(dirAndStem(href)[1]),
    href: href,
    order: asNumber(index?.markdown.yaml?.[kOrder]),
    empty: index ? inputTargetIsEmpty(index) : false,
  };
}

function titleFromPath(path: string) {
  const name = basename(path);
  // if there are no spaces then try to split on dashes/underscoes and autocapitalize
  if (!name.includes(" ")) {
    return capitalizeTitle(name.replaceAll(/[_\-]+/g, " "));
  } else {
    return name;
  }
}

function sidebarItemsFromEntries(entries: Entry[]): SidebarItem[] {
  return entries.map((entry) => {
    if (entry.children) {
      return {
        section: !entry.href || entry.empty ? entry.title : entry.href,
        contents: sidebarItemsFromEntries(entry.children),
      };
    } else {
      return {
        text: entry.title,
        href: entry.href,
      };
    }
  });
}
