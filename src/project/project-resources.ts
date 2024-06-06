/*
 * project-resources.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, extname, join, relative } from "../deno_ral/path.ts";
import * as ld from "../core/lodash.ts";
import { asArray } from "../core/array.ts";

import {
  normalizePath,
  resolvePathGlobs,
  safeExistsSync,
} from "../core/path.ts";
import { kCssImportRegex, kCssUrlRegex } from "../core/css.ts";

import {
  kProject404File,
  kProjectOutputDir,
  kProjectResources,
  ProjectConfig,
} from "./types.ts";

import { kQuartoIgnore } from "./project-gitignore.ts";
import { copyFileIfNewer } from "../core/copy.ts";
import { existsSync1 } from "../core/file.ts";

export function projectResourceFiles(
  dir: string,
  config: ProjectConfig,
): string[] {
  let resourceGlobs = asArray(config.project[kProjectResources]);
  const resourceFiles: string[] = [];
  // This usage of reading the output directory is necessary since we haven't
  // yet formed the project context (this function is used in creating the context)
  const outputDir = config.project[kProjectOutputDir];
  if (outputDir) {
    resourceGlobs = (resourceGlobs || [])
      // ignore standard quarto ignores (e.g. /.quarto/)
      .concat(kQuartoIgnore.map((entry) => `!${entry}`));

    const exclude = outputDir ? [outputDir] : [];
    const projectResourceFiles = resolvePathGlobs(
      dir,
      resourceGlobs,
      exclude,
    );
    resourceFiles.push(
      ...ld.difference(
        projectResourceFiles.include,
        projectResourceFiles.exclude,
      ),
    );
    // literals
    resourceFiles.push(
      ...["robots.txt", ".nojekyll", "CNAME", "_redirects", kProject404File]
        .map((file) => join(dir, file))
        .filter(existsSync1),
    );
  }
  return ld.uniq(resourceFiles);
}

export function copyResourceFile(
  rootDir: string,
  srcFile: string,
  destFile: string,
) {
  // ensure that the resource reference doesn't escape the root dir
  if (!normalizePath(srcFile).startsWith(normalizePath(rootDir))) {
    return;
  }

  ensureDirSync(dirname(destFile));
  copyFileIfNewer(srcFile, destFile);

  if (extname(srcFile).toLowerCase() === ".css") {
    handleCssReferences(rootDir, srcFile, destFile);
  }
}

export function fixupCssReferences(
  css: string,
  offset: string,
  onRef: (ref: string) => string,
) {
  // fixup / copy refs from url()
  let destCss = css.replaceAll(
    kCssUrlRegex,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      return `url(${p1 || ""}${onRef(ref)}${p1 || ""})`;
    },
  );

  // fixup / copy refs from @import
  destCss = destCss.replaceAll(
    kCssImportRegex,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      return `@import ${p1 || ""}${onRef(ref)}${p1 || ""}`;
    },
  );

  return destCss;
}

// fixup root ('/') css references and also copy references to other
// stylesheet or resources (e.g. images) to alongside the destFile
function handleCssReferences(
  rootDir: string,
  srcFile: string,
  destFile: string,
) {
  // read the css
  const css = Deno.readTextFileSync(destFile);

  // offset for root references
  const offset = relative(dirname(srcFile), rootDir);

  // function that can be used to copy a ref
  const copyRef = (ref: string) => {
    const refPath = join(dirname(srcFile), ref);
    if (safeExistsSync(refPath)) {
      const refDestPath = join(dirname(destFile), ref);
      copyResourceFile(rootDir, refPath, refDestPath);
    }
    return ref;
  };

  const destCss = fixupCssReferences(css, offset, copyRef);

  // write the css if necessary
  if (destCss !== css) {
    Deno.writeTextFileSync(destFile, destCss);
  }
}
