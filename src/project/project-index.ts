/*
* project-index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../core/lodash.ts";

import { ProjectContext } from "./types.ts";
import { Metadata } from "../config/types.ts";
import { Format } from "../config/types.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";

import {
  dirAndStem,
  pathWithForwardSlashes,
  removeIfExists,
} from "../core/path.ts";
import { kOutputFile, kTitle } from "../config/constants.ts";
import { renderFormats } from "../command/render/render.ts";
import { fileExecutionEngine } from "../execute/engine.ts";

import { projectConfigFile, projectOutputDir } from "./project-shared.ts";
import { projectScratchPath } from "./project-scratch.ts";
import { parsePandocTitle } from "../core/pandoc/pandoc-partition.ts";
import { readYaml } from "../core/yaml.ts";
import { formatKeys } from "../config/metadata.ts";
import {
  formatsPreferHtml,
  normalizeWebsiteFormat,
} from "./types/website/website-config.ts";
import { isJupyterNotebook } from "../core/jupyter/jupyter.ts";

export interface InputTargetIndex extends Metadata {
  title?: string;
  markdown: PartitionedMarkdown;
  formats: Record<string, Format>;
}

export async function inputTargetIndex(
  project: ProjectContext,
  input: string,
): Promise<InputTargetIndex | undefined> {
  // calculate input file
  const inputFile = join(project.dir, input);

  // return undefined if the file doesn't exist
  if (!existsSync(inputFile) || Deno.statSync(inputFile).isDirectory) {
    return Promise.resolve(undefined);
  }

  // filter it out if its not in the list of input files
  if (!project.files.input.includes(Deno.realPathSync(inputFile))) {
    return Promise.resolve(undefined);
  }

  // check if this can be handled by one of our engines
  const engine = fileExecutionEngine(inputFile);
  if (engine === undefined) {
    return Promise.resolve(undefined);
  }

  // see if we have an up to date index file (but not for notebooks
  // as they could have ipynb-filters that vary based on config)
  if (!isJupyterNotebook(input)) {
    const targetIndex = readInputTargetIndex(project.dir, input);
    if (targetIndex) {
      return targetIndex;
    }
  }

  // otherwise read the metadata and index it
  const formats = await renderFormats(inputFile, "all", project);
  const firstFormat = Object.values(formats)[0];
  const markdown = await engine.partitionedMarkdown(inputFile, firstFormat);
  const index = {
    title: (firstFormat?.metadata?.[kTitle] || markdown.yaml?.[kTitle] ||
      markdown.headingText) as
        | string
        | undefined,
    markdown,
    formats,
  };

  // if we got a title, make sure it doesn't carry attributes
  if (index.title) {
    const parsedTitle = parsePandocTitle(index.title);
    index.title = parsedTitle.heading;
  } else {
    // if there is no title then try to extract it from a header
    index.title = index.markdown.headingText;
  }

  const indexFile = inputTargetIndexFile(project.dir, input);
  Deno.writeTextFileSync(indexFile, JSON.stringify(index));
  return index;
}

// reads an existing input target index file
export function readInputTargetIndex(
  projectDir: string,
  input: string,
): InputTargetIndex | undefined {
  // check if we have an index that's still current visa-vi the
  // last modified date of the source file
  const index = readInputTargetIndexIfStillCurrent(projectDir, input);

  // if its still current visa-vi the input file, we then need to
  // check if the format list has changed (which is also an invalidation)
  if (index) {
    // normalize html to first if its included in the formats
    if (Object.keys(index.formats).includes("html")) {
      index.formats = normalizeWebsiteFormat(index.formats, true) as Record<
        string,
        Format
      >;
    }
    const formats = Object.keys(index.formats);
    const projConfigFile = projectConfigFile(projectDir);
    if (projConfigFile) {
      const config = readYaml(projConfigFile) as Metadata;
      const projFormats = formatKeys(config);
      if (ld.isEqual(formats, projFormats)) {
        return index;
      } else {
        return undefined;
      }
    } else {
      return index;
    }
  } else {
    return undefined;
  }
}

function readInputTargetIndexIfStillCurrent(projectDir: string, input: string) {
  const inputFile = join(projectDir, input);
  const indexFile = inputTargetIndexFile(projectDir, input);
  if (existsSync(indexFile)) {
    const inputMod = Deno.statSync(inputFile).mtime;
    const indexMod = Deno.statSync(indexFile).mtime;
    if (
      inputMod && indexMod && (indexMod >= inputMod)
    ) {
      try {
        return JSON.parse(Deno.readTextFileSync(indexFile)) as InputTargetIndex;
      } catch {
        return undefined;
      }
    }
  }
}

export async function resolveInputTarget(
  project: ProjectContext,
  href: string,
  absolute = true,
) {
  const index = await inputTargetIndex(project, href);
  if (index) {
    const formats = formatsPreferHtml(index.formats) as Record<string, Format>;
    const format = Object.values(formats)[0];
    const [hrefDir, hrefStem] = dirAndStem(href);
    const outputFile = format.pandoc[kOutputFile] || `${hrefStem}.html`;
    const outputHref = pathWithForwardSlashes(
      (absolute ? "/" : "") + join(hrefDir, outputFile),
    );
    return { title: index.title, outputHref };
  } else {
    return undefined;
  }
}

export async function inputFileForOutputFile(
  project: ProjectContext,
  output: string,
) {
  // compute output dir
  const outputDir = projectOutputDir(project);

  // full path to output (it's relative to output dir)
  output = join(outputDir, output);

  for (const file of project.files.input) {
    const inputRelative = relative(project.dir, file);
    const index = await inputTargetIndex(project, relative(project.dir, file));
    if (index) {
      const hasOutput = Object.keys(index.formats).some((key) => {
        const format = index.formats[key];
        if (format.pandoc[kOutputFile]) {
          const formatOutputPath = join(
            outputDir!,
            dirname(inputRelative),
            format.pandoc[kOutputFile]!,
          );
          return output === formatOutputPath;
        }
      });
      if (hasOutput) {
        return file;
      }
    }
  }
}

export async function inputTargetIndexForOutputFile(
  project: ProjectContext,
  outputRelative: string,
) {
  const input = await inputFileForOutputFile(project, outputRelative);
  if (input) {
    return await inputTargetIndex(project, relative(project.dir, input));
  } else {
    return undefined;
  }
}

export function clearProjectIndex(projectDir: string) {
  const indexPath = projectScratchPath(projectDir, "idx");
  removeIfExists(indexPath);
}

function inputTargetIndexFile(projectDir: string, input: string): string {
  return indexPath(projectDir, `${input}.json`);
}

function indexPath(projectDir: string, path: string): string {
  return projectScratchPath(projectDir, join("idx", path));
}
