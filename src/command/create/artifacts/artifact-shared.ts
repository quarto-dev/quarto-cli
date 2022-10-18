/*
* artifact-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { capitalizeTitle } from "../../../core/text.ts";
import { quartoConfig } from "../../../core/quarto.ts";
import { execProcess } from "../../../core/process.ts";
import { gfmAutoIdentifier } from "../../../core/pandoc/pandoc-id.ts";

import { coerce } from "semver/mod.ts";
import { info } from "log/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";
import { ensureDirSync, walkSync } from "fs/mod.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { safeExistsSync } from "../../../core/path.ts";

export interface CreateDirective {
  displayType: string;
  name: string;
  directory: string;
  template: string;
  options: Record<string, unknown>;
}

export interface CreateDirectiveData extends Record<string, string> {
  name: string;
  filesafename: string;
  classname: string;
  title: string;
  author: string;
  version: string;
  quartoversion: string;
}

// File paths that include this string will get fixed up
// and the value from the ejs data will be substituted
const keyRegExp = /^(.*)qstart-(.*)-qend(.*)$/gm;

export function renderTemplate(
  target: string,
  artifactSrcDir: string,
  createDirective: CreateDirective,
  data: CreateDirectiveData,
  quiet?: boolean,
) {
  // Ensure that the target directory exists and
  // copy the files
  ensureDirSync(target);

  // Walk the artifact directory, copying to the target
  // directoy and rendering as we go
  const copiedFiles: string[] = [];
  for (const artifact of walkSync(artifactSrcDir)) {
    if (artifact.isFile) {
      const targetFile = artifact.path.replaceAll(
        keyRegExp,
        (_match: string, prefix: string, key: string, suffix: string) => {
          if (data[key]) {
            return `${prefix}${data[key]}${suffix}`;
          } else {
            return artifact.path;
          }
        },
      );

      // Compute target paths
      const targetRelativePath = relative(artifactSrcDir, targetFile);
      const targetAbsolutePath = join(
        createDirective.directory,
        targetRelativePath,
      );

      // Render the EJS file rather than copying this file
      copiedFiles.push(renderArtifact(
        artifact.path,
        targetAbsolutePath,
        data,
      ));
    }
  }

  // Provide status - wait until the end
  // so that all files, renames, and so on will be completed
  // (since some paths will be variables that are resolved at the very end)
  if (!quiet) {
    info(`Creating ${createDirective.displayType} at `, { newline: false });
    info(`${createDirective.directory}`, { bold: true, newline: false });
    info(":");

    for (const copiedFile of copiedFiles) {
      const relPath = relative(createDirective.directory, copiedFile);
      info(
        `  - Created ${relPath}`,
      );
    }
  }

  return copiedFiles;
}

// Render an ejs file to the output directory
const renderArtifact = (
  src: string,
  target: string,
  data: CreateDirectiveData,
) => {
  const srcFileName = basename(src);

  if (srcFileName.includes(".ejs.")) {
    // The target file name
    const renderTarget = target.replace(/\.ejs\./, ".");

    if (safeExistsSync(renderTarget)) {
      throw new Error(`The file ${renderTarget} already exists.`);
    }

    // Render the EJS
    const rendered = renderEjs(src, data, false);

    // Write the rendered EJS to the output file
    ensureDirSync(dirname(renderTarget));
    Deno.writeTextFileSync(renderTarget, rendered);
    return renderTarget;
  } else {
    if (safeExistsSync(target)) {
      throw new Error(`The file ${target} already exists.`);
    }

    Deno.copyFileSync(src, target);
    return target;
  }
};

export async function ejsData(
  createDirective: CreateDirective,
): Promise<CreateDirectiveData> {
  // Name variants
  const title = capitalizeTitle(createDirective.name);

  const classname = title.replaceAll(/[^\w]/gm, "");
  const filesafename = gfmAutoIdentifier(createDirective.name, true);

  // Other metadata
  const version = "1.0.0";
  const author = await gitAuthor() || "First Last";

  // Limit the quarto version to the major and minor version
  const qVer = coerce(quartoConfig.version());
  const quartoversion = `${qVer?.major}.${qVer?.minor}.0`;

  return {
    name: createDirective.name,
    filesafename,
    title,
    classname,
    author: author.trim(),
    version,
    quartoversion,
  };
}

async function gitAuthor() {
  const result = await execProcess({
    cmd: ["git", "config", "--global", "user.name"],
    stdout: "piped",
    stderr: "piped",
  });
  if (result.success) {
    return result.stdout;
  } else {
    return undefined;
  }
}
