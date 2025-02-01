// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { type GlobOptions, globToRegExp } from "jsr:/@std/path@^0.224.0/glob-to-regexp";
import { joinGlobs } from "jsr:/@std/path@^0.224.0/join-globs";
import { isGlob } from "jsr:/@std/path@^0.224.0/is-glob";
import { isAbsolute } from "jsr:/@std/path@^0.224.0/is-absolute";
import { resolve } from "jsr:/@std/path@^0.224.0/resolve";
import { SEPARATOR_PATTERN } from "jsr:/@std/path@^0.224.0/constants";
import { walk, walkSync } from "./walk.ts";
import { assert } from "jsr:/@std/assert@^0.224.0/assert";
import { toPathString } from "./_to_path_string.ts";
import {
  createWalkEntry,
  createWalkEntrySync,
  type WalkEntry,
} from "./_create_walk_entry.ts";

export type { GlobOptions, WalkEntry };

const isWindows = Deno.build.os === "windows";

/** Options for {@linkcode expandGlob} and {@linkcode expandGlobSync}. */
export interface ExpandGlobOptions extends Omit<GlobOptions, "os"> {
  /** File path where to expand from. */
  root?: string;
  /** List of glob patterns to be excluded from the expansion. */
  exclude?: string[];
  /**
   * Whether to include directories in entries.
   *
   * @default {true}
   */
  includeDirs?: boolean;
  /**
   * Whether to follow symbolic links.
   *
   * @default {false}
   */
  followSymlinks?: boolean;
  /**
   * Indicates whether the followed symlink's path should be canonicalized.
   * This option works only if `followSymlinks` is not `false`.
   *
   * @default {true}
   */
  canonicalize?: boolean;
}

interface SplitPath {
  segments: string[];
  isAbsolute: boolean;
  hasTrailingSep: boolean;
  // Defined for any absolute Windows path.
  winRoot?: string;
}

function split(path: string): SplitPath {
  const s = SEPARATOR_PATTERN.source;
  const segments = path
    .replace(new RegExp(`^${s}|${s}$`, "g"), "")
    .split(SEPARATOR_PATTERN);
  const isAbsolute_ = isAbsolute(path);
  return {
    segments,
    isAbsolute: isAbsolute_,
    hasTrailingSep: !!path.match(new RegExp(`${s}$`)),
    winRoot: isWindows && isAbsolute_ ? segments.shift() : undefined,
  };
}

function throwUnlessNotFound(error: unknown) {
  if (!(error instanceof Deno.errors.NotFound)) {
    throw error;
  }
}

function comparePath(a: WalkEntry, b: WalkEntry): number {
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
}

/**
 * Returns an async iterator that yields each file path matching the given glob
 * pattern. The file paths are relative to the provided `root` directory.
 * If `root` is not provided, the current working directory is used.
 * The `root` directory is not included in the yielded file paths.
 *
 * Requires the `--allow-read` flag.
 *
 * @param glob The glob pattern to expand.
 * @param options Additional options for the expansion.
 * @returns An async iterator that yields each walk entry matching the glob
 * pattern.
 *
 * @example Basic usage
 *
 * File structure:
 * ```
 * folder
 * ├── script.ts
 * └── foo.ts
 * ```
 *
 * ```ts
 * // script.ts
 * import { expandGlob } from "@std/fs/expand-glob";
 *
 * const entries = [];
 * for await (const entry of expandGlob("*.ts")) {
 *   entries.push(entry);
 * }
 *
 * entries[0]!.path; // "/Users/user/folder/script.ts"
 * entries[0]!.name; // "script.ts"
 * entries[0]!.isFile; // false
 * entries[0]!.isDirectory; // true
 * entries[0]!.isSymlink; // false
 *
 * entries[1]!.path; // "/Users/user/folder/foo.ts"
 * entries[1]!.name; // "foo.ts"
 * entries[1]!.isFile; // true
 * entries[1]!.isDirectory; // false
 * entries[1]!.isSymlink; // false
 * ```
 */
export async function* expandGlob(
  glob: string | URL,
  {
    root,
    exclude = [],
    includeDirs = true,
    extended = true,
    globstar = true,
    caseInsensitive,
    followSymlinks,
    canonicalize,
  }: ExpandGlobOptions = {},
): AsyncIterableIterator<WalkEntry> {
  const {
    segments,
    isAbsolute: isGlobAbsolute,
    hasTrailingSep,
    winRoot,
  } = split(toPathString(glob));
  root ??= isGlobAbsolute ? winRoot ?? "/" : Deno.cwd();

  const globOptions: GlobOptions = { extended, globstar, caseInsensitive };
  const absRoot = isGlobAbsolute ? root : resolve(root!); // root is always string here
  const resolveFromRoot = (path: string): string => resolve(absRoot, path);
  const excludePatterns = exclude
    .map(resolveFromRoot)
    .map((s: string): RegExp => globToRegExp(s, globOptions));
  const shouldInclude = (path: string): boolean =>
    !excludePatterns.some((p: RegExp): boolean => !!path.match(p));

  let fixedRoot = isGlobAbsolute
    ? winRoot !== undefined ? winRoot : "/"
    : absRoot;
  while (segments.length > 0 && !isGlob(segments[0]!)) {
    const seg = segments.shift();
    assert(seg !== undefined);
    fixedRoot = joinGlobs([fixedRoot, seg], globOptions);
  }

  let fixedRootInfo: WalkEntry;
  try {
    fixedRootInfo = await createWalkEntry(fixedRoot);
  } catch (error) {
    return throwUnlessNotFound(error);
  }

  async function* advanceMatch(
    walkInfo: WalkEntry,
    globSegment: string,
  ): AsyncIterableIterator<WalkEntry> {
    if (!walkInfo.isDirectory) {
      return;
    } else if (globSegment === "..") {
      const parentPath = joinGlobs([walkInfo.path, ".."], globOptions);
      try {
        if (shouldInclude(parentPath)) {
          return yield await createWalkEntry(parentPath);
        }
      } catch (error) {
        throwUnlessNotFound(error);
      }
      return;
    } else if (globSegment === "**") {
      return yield* walk(walkInfo.path, {
        skip: excludePatterns,
        maxDepth: globstar ? Infinity : 1,
        followSymlinks,
        canonicalize,
      });
    }
    const globPattern = globToRegExp(globSegment, globOptions);
    for await (
      const walkEntry of walk(walkInfo.path, {
        maxDepth: 1,
        skip: excludePatterns,
        followSymlinks,
      })
    ) {
      if (
        walkEntry.path !== walkInfo.path &&
        walkEntry.name.match(globPattern)
      ) {
        yield walkEntry;
      }
    }
  }

  let currentMatches: WalkEntry[] = [fixedRootInfo];
  for (const segment of segments) {
    // Advancing the list of current matches may introduce duplicates, so we
    // pass everything through this Map.
    const nextMatchMap: Map<string, WalkEntry> = new Map();
    await Promise.all(
      currentMatches.map(async (currentMatch) => {
        for await (const nextMatch of advanceMatch(currentMatch, segment)) {
          nextMatchMap.set(nextMatch.path, nextMatch);
        }
      }),
    );
    currentMatches = [...nextMatchMap.values()].sort(comparePath);
  }

  if (hasTrailingSep) {
    currentMatches = currentMatches.filter(
      (entry: WalkEntry): boolean => entry.isDirectory,
    );
  }
  if (!includeDirs) {
    currentMatches = currentMatches.filter(
      (entry: WalkEntry): boolean => !entry.isDirectory,
    );
  }
  yield* currentMatches;
}

/**
 * Returns an iterator that yields each file path matching the given glob
 * pattern. The file paths are relative to the provided `root` directory.
 * If `root` is not provided, the current working directory is used.
 * The `root` directory is not included in the yielded file paths.
 *
 * Requires the `--allow-read` flag.
 *
 * @param glob The glob pattern to expand.
 * @param options Additional options for the expansion.
 * @returns An iterator that yields each walk entry matching the glob pattern.
 *
 * @example Basic usage
 *
 * File structure:
 * ```
 * folder
 * ├── script.ts
 * └── foo.ts
 * ```
 *
 * ```ts
 * // script.ts
 * import { expandGlobSync } from "@std/fs/expand-glob";
 *
 * const entries = [];
 * for (const entry of expandGlobSync("*.ts")) {
 *   entries.push(entry);
 * }
 *
 * entries[0]!.path; // "/Users/user/folder/script.ts"
 * entries[0]!.name; // "script.ts"
 * entries[0]!.isFile; // false
 * entries[0]!.isDirectory; // true
 * entries[0]!.isSymlink; // false
 *
 * entries[1]!.path; // "/Users/user/folder/foo.ts"
 * entries[1]!.name; // "foo.ts"
 * entries[1]!.isFile; // true
 * entries[1]!.isDirectory; // false
 * entries[1]!.isSymlink; // false
 * ```
 */
export function* expandGlobSync(
  glob: string | URL,
  {
    root,
    exclude = [],
    includeDirs = true,
    extended = true,
    globstar = true,
    caseInsensitive,
    followSymlinks,
    canonicalize,
  }: ExpandGlobOptions = {},
): IterableIterator<WalkEntry> {
  const {
    segments,
    isAbsolute: isGlobAbsolute,
    hasTrailingSep,
    winRoot,
  } = split(toPathString(glob));
  root ??= isGlobAbsolute ? winRoot ?? "/" : Deno.cwd();

  const globOptions: GlobOptions = { extended, globstar, caseInsensitive };
  const absRoot = isGlobAbsolute ? root : resolve(root!); // root is always string here
  const resolveFromRoot = (path: string): string => resolve(absRoot, path);
  const excludePatterns = exclude
    .map(resolveFromRoot)
    .map((s: string): RegExp => globToRegExp(s, globOptions));
  const shouldInclude = (path: string): boolean =>
    !excludePatterns.some((p: RegExp): boolean => !!path.match(p));

  let fixedRoot = isGlobAbsolute
    ? winRoot !== undefined ? winRoot : "/"
    : absRoot;
  while (segments.length > 0 && !isGlob(segments[0]!)) {
    const seg = segments.shift();
    assert(seg !== undefined);
    fixedRoot = joinGlobs([fixedRoot, seg], globOptions);
  }

  let fixedRootInfo: WalkEntry;
  try {
    fixedRootInfo = createWalkEntrySync(fixedRoot);
  } catch (error) {
    return throwUnlessNotFound(error);
  }

  function* advanceMatch(
    walkInfo: WalkEntry,
    globSegment: string,
  ): IterableIterator<WalkEntry> {
    if (!walkInfo.isDirectory) {
      return;
    } else if (globSegment === "..") {
      const parentPath = joinGlobs([walkInfo.path, ".."], globOptions);
      try {
        if (shouldInclude(parentPath)) {
          return yield createWalkEntrySync(parentPath);
        }
      } catch (error) {
        throwUnlessNotFound(error);
      }
      return;
    } else if (globSegment === "**") {
      return yield* walkSync(walkInfo.path, {
        skip: excludePatterns,
        maxDepth: globstar ? Infinity : 1,
        followSymlinks,
        canonicalize,
      });
    }
    const globPattern = globToRegExp(globSegment, globOptions);
    for (
      const walkEntry of walkSync(walkInfo.path, {
        maxDepth: 1,
        skip: excludePatterns,
        followSymlinks,
      })
    ) {
      if (
        walkEntry.path !== walkInfo.path &&
        walkEntry.name.match(globPattern)
      ) {
        yield walkEntry;
      }
    }
  }

  let currentMatches: WalkEntry[] = [fixedRootInfo];
  for (const segment of segments) {
    // Advancing the list of current matches may introduce duplicates, so we
    // pass everything through this Map.
    const nextMatchMap: Map<string, WalkEntry> = new Map();
    for (const currentMatch of currentMatches) {
      for (const nextMatch of advanceMatch(currentMatch, segment)) {
        nextMatchMap.set(nextMatch.path, nextMatch);
      }
    }
    currentMatches = [...nextMatchMap.values()].sort(comparePath);
  }

  if (hasTrailingSep) {
    currentMatches = currentMatches.filter(
      (entry: WalkEntry): boolean => entry.isDirectory,
    );
  }
  if (!includeDirs) {
    currentMatches = currentMatches.filter(
      (entry: WalkEntry): boolean => !entry.isDirectory,
    );
  }
  yield* currentMatches;
}
