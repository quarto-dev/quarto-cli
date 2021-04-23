/*
* project-resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, extname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { resolvePathGlobs } from "../core/path.ts";
import { kCssImportRegex, kCssUrlRegex } from "../core/css.ts";

import {
  kProjectOutputDir,
  kProjectResources,
  ProjectConfig,
} from "./project-context.ts";
import { kGitignoreEntries } from "./project-gitignore.ts";

export function projectResourceFiles(
  dir: string,
  config: ProjectConfig,
): string[] {
  let resourceGlobs = config.project[kProjectResources];
  if (resourceGlobs) {
    const resourceFiles: string[] = [];
    const outputDir = config.project[kProjectOutputDir];
    if (outputDir) {
      resourceGlobs = resourceGlobs
        // ignore anything specified in our standard .gitignore
        .concat(kGitignoreEntries.map((entry) => `!${entry}`))
        .concat(["robots.txt"]);

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
    }
    return ld.uniq(resourceFiles);
  } else {
    return [];
  }
}

export function copyResourceFile(
  rootDir: string,
  srcFile: string,
  destFile: string,
) {
  // ensure that the resource reference doesn't escape the root dir
  if (!Deno.realPathSync(srcFile).startsWith(Deno.realPathSync(rootDir))) {
    return;
  }

  ensureDirSync(dirname(destFile));
  copySync(srcFile, destFile, {
    overwrite: true,
    preserveTimestamps: true,
  });

  if (extname(srcFile).toLowerCase() === ".css") {
    handleCssReferences(rootDir, srcFile, destFile);
  }
}

export function fixupCssReferences(
  css: string,
  offset: string,
  onRef: (ref: string) => void,
) {
  // fixup / copy refs from url()
  let destCss = css.replaceAll(
    kCssUrlRegex,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      onRef(ref);
      return `url(${p1}${ref}${p1})`;
    },
  );

  // fixup / copy refs from @import
  destCss = destCss.replaceAll(
    kCssImportRegex,
    (_match, p1: string, p2: string) => {
      const ref = p2.startsWith("/") ? `${offset}${p2.slice(1)}` : p2;
      onRef(ref);
      return `@import ${p1}${ref}${p1}`;
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
    if (existsSync(refPath)) {
      const refDestPath = join(dirname(destFile), ref);
      copyResourceFile(rootDir, refPath, refDestPath);
    }
  };

  const destCss = fixupCssReferences(css, offset, copyRef);

  // write the css if necessary
  if (destCss !== css) {
    Deno.writeTextFileSync(destFile, destCss);
  }
}
