// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.
import { assert } from "../_util/asserts.ts";
import { join, normalize } from "../path/mod.ts";
import {
  createWalkEntry,
  createWalkEntrySync,
  toPathString,
  WalkEntry,
} from "./_util.ts";

function include(
  path: string,
  exts?: string[],
  match?: RegExp[],
  skip?: RegExp[],
): boolean {
  if (exts && !exts.some((ext): boolean => path.endsWith(ext))) {
    return false;
  }
  if (match && !match.some((pattern): boolean => !!path.match(pattern))) {
    return false;
  }
  if (skip && skip.some((pattern): boolean => !!path.match(pattern))) {
    return false;
  }
  return true;
}

function wrapErrorWithRootPath(err: unknown, root: string) {
  if (err instanceof Error && "root" in err) return err;
  const e = new Error() as Error & { root: string };
  e.root = root;
  e.message = err instanceof Error
    ? `${err.message} for path "${root}"`
    : `[non-error thrown] for path "${root}"`;
  e.stack = err instanceof Error ? err.stack : undefined;
  e.cause = err instanceof Error ? err.cause : undefined;
  return e;
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  followSymlinks?: boolean;
  exts?: string[];
  match?: RegExp[];
  skip?: RegExp[];
}
export type { WalkEntry };

/** Walks the file tree rooted at root, yielding each file or directory in the
 * tree filtered according to the given options.
 *
 * Options:
 * - maxDepth?: number = Infinity;
 * - includeFiles?: boolean = true;
 * - includeDirs?: boolean = true;
 * - followSymlinks?: boolean = false;
 * - exts?: string[];
 * - match?: RegExp[];
 * - skip?: RegExp[];
 *
 * ```ts
 *       import { walk } from "https://deno.land/std@$STD_VERSION/fs/walk.ts";
 *       import { assert } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 *       for await (const entry of walk(".")) {
 *         console.log(entry.path);
 *         assert(entry.isFile);
 *       }
 * ```
 */
export async function* walk(
  root: string | URL,
  {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    followSymlinks = false,
    exts = undefined,
    match = undefined,
    skip = undefined,
  }: WalkOptions = {},
): AsyncIterableIterator<WalkEntry> {
  if (maxDepth < 0) {
    return;
  }
  root = toPathString(root);
  if (includeDirs && include(root, exts, match, skip)) {
    yield await createWalkEntry(root);
  }
  if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
    return;
  }
  try {
    for await (const entry of Deno.readDir(root)) {
      assert(entry.name != null);
      let path = join(root, entry.name);

      let { isSymlink, isDirectory } = entry;

      if (isSymlink) {
        if (!followSymlinks) continue;
        path = await Deno.realPath(path);
        // Caveat emptor: don't assume |path| is not a symlink. realpath()
        // resolves symlinks but another process can replace the file system
        // entity with a different type of entity before we call lstat().
        ({ isSymlink, isDirectory } = await Deno.lstat(path));
      }

      if (isSymlink || isDirectory) {
        yield* walk(path, {
          maxDepth: maxDepth - 1,
          includeFiles,
          includeDirs,
          followSymlinks,
          exts,
          match,
          skip,
        });
      } else if (includeFiles && include(path, exts, match, skip)) {
        yield { path, ...entry };
      }
    }
  } catch (err) {
    throw wrapErrorWithRootPath(err, normalize(root));
  }
}

/** Same as walk() but uses synchronous ops */
export function* walkSync(
  root: string | URL,
  {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    followSymlinks = false,
    exts = undefined,
    match = undefined,
    skip = undefined,
  }: WalkOptions = {},
): IterableIterator<WalkEntry> {
  root = toPathString(root);
  if (maxDepth < 0) {
    return;
  }
  if (includeDirs && include(root, exts, match, skip)) {
    yield createWalkEntrySync(root);
  }
  if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
    return;
  }
  let entries;
  try {
    entries = Deno.readDirSync(root);
  } catch (err) {
    throw wrapErrorWithRootPath(err, normalize(root));
  }
  for (const entry of entries) {
    assert(entry.name != null);
    let path = join(root, entry.name);

    let { isSymlink, isDirectory } = entry;

    if (isSymlink) {
      if (!followSymlinks) continue;
      path = Deno.realPathSync(path);
      // Caveat emptor: don't assume |path| is not a symlink. realpath()
      // resolves symlinks but another process can replace the file system
      // entity with a different type of entity before we call lstat().
      ({ isSymlink, isDirectory } = Deno.lstatSync(path));
    }

    if (isSymlink || isDirectory) {
      yield* walkSync(path, {
        maxDepth: maxDepth - 1,
        includeFiles,
        includeDirs,
        followSymlinks,
        exts,
        match,
        skip,
      });
    } else if (includeFiles && include(path, exts, match, skip)) {
      yield { path, ...entry };
    }
  }
}
