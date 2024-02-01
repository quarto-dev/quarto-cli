/*
 * website-sidebar-auto.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
        if (typeof (item.contents) === "string") {
          // if this is a section, check to see if we should be linking to an
          // index file inside the section
          if (item.section) {
            // don't add link if there already is one
            const hasProjectHref = project.files.input.includes(
              join(project.dir, item.section),
            ) || (item.href && project.files.input.includes(
              join(project.dir, item.href),
            ));
            if (!hasProjectHref) {
              // is this a globbed directory?
              const globbedDir = globbedDirectory(project, item.contents);
              if (globbedDir) {
                const indexFileHref = indexFileHrefForDir(project, globbedDir);
                if (indexFileHref) {
                  item.text = item.section;
                  item.section = indexFileHref;
                }
              }
            }
          }
        }
        // expand contents
        item.contents = await expandAutoSidebarItems(project, item.contents);
      }
      expanded.push(item);
    }
  }
  return expanded;
}

function globbedDirectory(project: ProjectContext, contentsGlob: string) {
  const isValidDirectory = (dir: string) => {
    return safeExistsSync(dir) && Deno.statSync(dir).isDirectory;
  };

  // literal target dir
  const literalTargetDir = join(project.dir, contentsGlob);
  if (isValidDirectory(literalTargetDir)) {
    return literalTargetDir;
  }

  // glob pattern (e.g. foo/* or foo/** )
  const match = contentsGlob.match(/(.*?)\/\*.*$/);
  if (match) {
    const globTargetDir = join(project.dir, match[1]);
    if (isValidDirectory(globTargetDir)) {
      return globTargetDir;
    }
  }
}

// sidebar items (e.g. contents: ) are an array in the type system, however
// contents: auto and contents: auto: true are both valid, which are not
// arrays -- here we fix it all up
function normalizeSidebarItems(items: SidebarItem[]) {
  if (!Array.isArray(items)) {
    if (typeof items === "string") {
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
  // is this a single directory that exists
  const isAutoDir = typeof auto === "string" &&
    !!auto.match(/^[^\*]+$/) &&
    safeExistsSync(join(project.dir, auto));

  // list of globs from auto
  const globs: string[] = globsFromAuto(project, auto);

  // scan for inputs and organize them into heirarchical nodes
  const entries: Entry[] = [];
  for (const nodeSet of autoSidebarNodes(project, globs)) {
    // if this is an auto-dir that has an index page inside it
    // then re-shuffle things a bit
    if (isAutoDir) {
      const root = nodeSet.root.split("/");
      nodeSet.root = root.slice(0, -1).join("/");
      nodeSet.nodes = {
        [root.slice(-1)[0]]: nodeSet.nodes,
      };
    }

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
  if (typeof auto === "boolean") {
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
      .filter((input) => !/^index\.\w+$/.test(input))
      .map((input) => pathWithForwardSlashes(relative(project.dir, input)));

    // is this a directory glob?
    let directory = "";
    const match = glob.match(/(.*?)[\/\\]\*.*$/);
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
  basename: string;
  href?: string;
  order?: number;
  empty?: boolean;
  draft?: boolean;
  children?: Entry[];
};

function indexFileHrefForDir(project: ProjectContext, dir: string) {
  const indexFileExt = engineValidExtensions().find((ext) => {
    return safeExistsSync(join(dir, `index${ext}`));
  });
  if (indexFileExt) {
    return relative(project.dir, join(dir, `index${indexFileExt}`));
  }
}

async function nodesToEntries(
  project: ProjectContext,
  root: string,
  nodes: SidebarNodes,
) {
  // clone the nodes (as we may mutate them)
  nodes = ld.cloneDeep(nodes) as SidebarNodes;

  // if there is an index file in the root then remove it
  // (as the higher level section handler will find it)
  const indexFile = findIndexFile(nodes);
  if (indexFile) {
    delete nodes[indexFile];
  }

  const entries: Entry[] = [];

  for (const node of Object.keys(nodes)) {
    const href = `${root}${node}`;
    const path = join(project.dir, href);
    if (safeExistsSync(path)) {
      if (Deno.statSync(path).isDirectory) {
        // get child nodes (we may mutate so make a copy)
        const childNodes = ld.cloneDeep(nodes[node]) as SidebarNodes;

        // remove any index file and use it as the link for the parent
        const indexFile = findIndexFile(childNodes);
        if (indexFile) {
          delete childNodes[indexFile];
        }

        if (indexFile) {
          entries.push({
            ...await entryFromHref(
              project,
              relative(project.dir, join(path, indexFile)),
            ),
            children: (childNodes && Object.keys(childNodes).length > 0)
              ? await nodesToEntries(
                project,
                `${root}${node}/`,
                childNodes,
              )
              : undefined,
          });
        } else {
          entries.push({
            title: titleFromPath(href),
            basename: basename(href),
            children: await nodesToEntries(
              project,
              `${root}${node}/`,
              childNodes,
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

function findIndexFile(nodes: SidebarNodes) {
  return Object.keys(nodes).find((input) => /^index\.\w+$/.test(input));
}

function sortEntries(a: Entry, b: Entry) {
  const filenameOrder = a.basename.toLocaleUpperCase().localeCompare(
    b.basename.toLocaleUpperCase(),
  );
  if (a.order !== undefined && b.order !== undefined) {
    const order = a.order - b.order;
    return order !== 0 ? order : filenameOrder;
  } else if (a.order !== undefined) {
    return -1;
  } else if (b.order !== undefined) {
    return 1;
  } else {
    if (a.children && !b.children) {
      return 1;
    } else if (b.children && !a.children) {
      return -1;
    } else {
      return filenameOrder;
    }
  }
}

async function entryFromHref(project: ProjectContext, href: string) {
  const index = await inputTargetIndex(project, pathWithForwardSlashes(href));
  const resolved = await resolveInputTarget(
    project,
    pathWithForwardSlashes(href),
  );
  const basename = dirAndStem(href)[1];
  return {
    title: index?.title ||
      resolved?.title ||
      titleFromPath(basename),
    basename,
    href: href,
    order: asNumber(index?.markdown.yaml?.[kOrder]),
    empty: index ? inputTargetIsEmpty(index) : false,
    draft: resolved?.draft,
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
        draft: entry.draft,
      };
    }
  });
}
