/*
 * website-aliases.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, extname, join, relative } from "../../../deno_ral/path.ts";

import { ProjectOutputFile } from "../types.ts";

import { ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { renderEjs } from "../../../core/ejs.ts";
import { resourcePath } from "../../../core/resources.ts";
import { inputTargetIndex, resolveInputTarget } from "../../project-index.ts";
import { warning } from "../../../deno_ral/log.ts";

const kAliases = "aliases";

export async function updateAliases(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  // Generate a map of the redirect files and targetHrefs redirect data
  const redirectMap: Record<string, Anchor[]> = {};
  const allOutputFiles: string[] = [];
  const outputDir = projectOutputDir(context);

  // First go through any files that were rendered and add any Aliases
  // to the map of aliases that we'll use to generate the redirect files.
  for (const outputFile of outputFiles) {
    const aliases = outputFile.format.metadata[kAliases];
    if (aliases && Array.isArray(aliases)) {
      addRedirectsToMap(aliases, outputFile.file, outputDir, true, redirectMap);
    }
  }

  // Walk through the outputs (to make sure we're not overwriting one with an alias file and
  // to see if they have any aliases to contribute)
  if (Object.keys(redirectMap).length > 0) {
    for (const file of context.files.input) {
      const relativePath = relative(context.dir, file);
      const inputIndexEntry = await inputTargetIndex(
        context,
        relativePath,
      );
      if (inputIndexEntry) {
        // The html format
        const format = Object.values(inputIndexEntry.formats)[0];

        // Find the target output file
        const outputTarget = await resolveInputTarget(
          context,
          relativePath,
          false,
        );
        if (outputTarget) {
          // Note the full path to the outputs of this project
          const projOutputDir = projectOutputDir(context);
          allOutputFiles.push(
            join(
              projOutputDir,
              outputTarget.outputHref,
            ),
          );

          // If this is incremental, go through the project inputs and for any of the inputs
          // that would need to contribute to one of the redirect files generated above, add
          // their aliases to the redirect data structure
          if (incremental) {
            // Read the aliases and process them
            const aliases = format.metadata[kAliases];
            if (aliases && Array.isArray(aliases)) {
              addRedirectsToMap(
                aliases,
                join(outputDir, outputTarget.outputHref),
                outputDir,
                false,
                redirectMap,
              );
            }
          }
        }
      }
    }
  }

  // For each of the target redirect files, generate the data structure
  // and render the ejs template
  for (const targetFile of Object.keys(redirectMap)) {
    const targetHrefs = redirectMap[targetFile];

    const redirects: Record<string, string> = {};
    for (const targetHref of targetHrefs) {
      // Resolve the href to the file
      const aliasHref = relative(dirname(targetFile), targetHref.outputFile);

      redirects[targetHref.hash || ""] = aliasHref;
    }

    // Make sure the directory exists
    if (!existsSync(targetFile)) {
      ensureDirSync(dirname(targetFile));
    }

    // Write the redirect file
    if (allOutputFiles.find((outputFile) => outputFile === targetFile)) {
      // Do not, this is the same name as an output file!
      warning(
        `Aliases that you have created would overwrite the output file ${targetFile}. The aliases file was not created.`,
      );
    } else {
      // Write, this is a safe file
      writeMultipleRedirectPage(targetFile, redirects);
    }
  }
}

function addRedirectsToMap(
  aliases: string[],
  outputFile: string,
  outputDir: string,
  allowNewAnchors: boolean,
  anchorMap: Record<string, Anchor[]>,
) {
  for (const alias of aliases) {
    const anchor = toAnchor(alias as string, outputFile);

    // The file to write
    const aliasTarget = anchor.href.startsWith("/")
      ? join(outputDir, anchor.href.slice(1))
      : join(dirname(outputFile), anchor.href);

    if (allowNewAnchors && !anchorMap[aliasTarget]) {
      anchorMap[aliasTarget] = [];
    }
    if (anchorMap[aliasTarget]) {
      anchorMap[aliasTarget].push(anchor);
    }
  }
}

interface Anchor {
  href: string;
  hash?: string;
  outputFile: string;
}

// Converts raw
function toAnchor(url: string, outputFile: string): Anchor {
  // Ensure the alias points to a file
  // (for paths like /foo/ or /foo)
  const fixupHref = (href: string) => {
    if (href.endsWith("/")) {
      return `${href}index.html`;
    } else if (extname(href) === "") {
      return `${href}/index.html`;
    } else {
      return href;
    }
  };

  // See if the alias contains an hash
  if (url.includes("#")) {
    const anchorParts = url.split("#");
    return {
      href: fixupHref(anchorParts[0]),
      outputFile,
      hash: anchorParts[1],
    };
  } else {
    return {
      href: fixupHref(url),
      outputFile,
    };
  }
}

// Write the redirect html page
export function writeMultipleRedirectPage(
  path: string,
  redirects: Record<string, string>,
) {
  const redirectTemplate = resourcePath(
    "projects/website/templates/redirect-map.ejs",
  );
  const redirectHtml = renderEjs(redirectTemplate, {
    redirects,
  });

  Deno.writeTextFileSync(path, redirectHtml);
}
