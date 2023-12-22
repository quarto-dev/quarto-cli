/*
 * project-index.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, join, relative } from "path/mod.ts";

import * as ld from "../core/lodash.ts";

import { kProjectType, ProjectContext } from "./types.ts";
import { Metadata } from "../config/types.ts";
import { Format } from "../config/types.ts";
import { PartitionedMarkdown } from "../core/pandoc/types.ts";

import {
  dirAndStem,
  normalizePath,
  pathWithForwardSlashes,
  removeIfExists,
  safeExistsSync,
} from "../core/path.ts";
import { kTitle } from "../config/constants.ts";
import { fileExecutionEngine } from "../execute/engine.ts";

import { projectConfigFile, projectOutputDir } from "./project-shared.ts";
import { projectScratchPath } from "./project-scratch.ts";
import { parsePandocTitle } from "../core/pandoc/pandoc-partition.ts";
import { readYamlFromString } from "../core/yaml.ts";
import { formatKeys } from "../config/metadata.ts";
import {
  formatsPreferHtml,
  websiteFormatPreferHtml,
} from "./types/website/website-config.ts";
import { kDefaultProjectFileContents } from "./types/project-default.ts";
import { formatOutputFile } from "../core/render.ts";
import { projectType } from "./types/project-types.ts";
import { withRenderServices } from "../command/render/render-services.ts";
import { RenderServices } from "../command/render/types.ts";

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
  if (!safeExistsSync(inputFile) || Deno.statSync(inputFile).isDirectory) {
    return Promise.resolve(undefined);
  }

  // filter it out if its not in the list of input files
  if (!project.files.input.includes(normalizePath(inputFile))) {
    return Promise.resolve(undefined);
  }

  // see if we have an up to date index file (but not for notebooks
  // as they could have ipynb-filters that vary based on config)
  const { index: targetIndex } = readInputTargetIndex(
    project.dir,
    input,
  );

  // There is already a targetIndex entry, just use that
  if (targetIndex) {
    return targetIndex;
  }

  // Create an index entry for the input
  const index = await readBaseInputIndex(inputFile, project);
  if (index) {
    const indexFile = inputTargetIndexFile(project.dir, input);
    Deno.writeTextFileSync(indexFile, JSON.stringify(index));
  }
  return index;
}

export async function readBaseInputIndex(
  inputFile: string,
  project: ProjectContext,
) {
  // check if this can be handled by one of our engines
  const engine = fileExecutionEngine(inputFile);
  if (engine === undefined) {
    return Promise.resolve(undefined);
  }

  // otherwise read the metadata and index it
  const formats = await withRenderServices(
    project.notebookContext,
    (services: RenderServices) =>
      project.renderFormats(inputFile, services, "all", project),
  );
  const firstFormat = Object.values(formats)[0];
  const markdown = await engine.partitionedMarkdown(inputFile, firstFormat);
  const index: InputTargetIndex = {
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

  if (project.config) {
    index.projectFormats = formatKeys(project.config);
  }

  return index;
}

// reads an existing input target index file
export function readInputTargetIndex(
  projectDir: string,
  input: string,
): {
  index?: InputTargetIndex;
  missingReason?: "stale" | "formats";
} {
  // check if we have an index that's still current vis-a-vis the
  // last modified date of the source file
  const index = readInputTargetIndexIfStillCurrent(projectDir, input);
  if (!index) {
    return {
      missingReason: "stale",
    };
  }

  // if its still current vis-a-vis the input file, we then need to
  // check if the format list has changed (which is also an invalidation)

  // normalize html to first if its included in the formats
  if (Object.keys(index.formats).includes("html")) {
    // note that the cast it okay here b/c we know that index.formats
    // includes only full format objects
    index.formats = websiteFormatPreferHtml(index.formats) as Record<
      string,
      Format
    >;
  }

  // when we write the index to disk we write it with the formats
  // so we need to check if the formats have changed
  const formats = (index.projectFormats as string[] | undefined) ??
    Object.keys(index.formats);
  const projConfigFile = projectConfigFile(projectDir);
  if (!projConfigFile) {
    return { index };
  }

  let contents = Deno.readTextFileSync(projConfigFile);
  if (contents.trim().length === 0) {
    contents = kDefaultProjectFileContents;
  }
  const config = readYamlFromString(contents) as Metadata;
  const projFormats = formatKeys(config);
  if (ld.isEqual(formats, projFormats)) {
    return {
      index,
    };
  } else {
    return {
      missingReason: "formats",
    };
  }
}

export function inputTargetIsEmpty(index: InputTargetIndex) {
  // if we have markdown we are not empty
  if (index.markdown.markdown.trim().length > 0) {
    return false;
  }

  // if we have a key other than title we are not empty
  if (
    index.markdown.yaml &&
    Object.keys(index.markdown.yaml).find((key) => key !== kTitle)
  ) {
    return false;
  }

  // otherwise we are empty
  return true;
}

const inputTargetIndexCache = new Map<string, InputTargetIndex>();
export const inputTargetIndexCacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

function readInputTargetIndexIfStillCurrent(projectDir: string, input: string) {
  const inputFile = join(projectDir, input);
  const indexFile = inputTargetIndexFile(projectDir, input);
  try {
    const inputMod = Deno.statSync(inputFile).mtime;
    const indexMod = Deno.statSync(indexFile).mtime;
    if (
      inputMod && indexMod
    ) {
      if (inputMod > indexMod) {
        inputTargetIndexCacheMetrics.invalidations++;
        inputTargetIndexCache.delete(indexFile);
        return undefined;
      }

      if (inputTargetIndexCache.has(indexFile)) {
        inputTargetIndexCacheMetrics.hits++;
        return inputTargetIndexCache.get(indexFile);
      } else {
        inputTargetIndexCacheMetrics.misses++;
        try {
          const result = JSON.parse(
            Deno.readTextFileSync(indexFile),
          ) as InputTargetIndex;
          inputTargetIndexCache.set(indexFile, result);
          return result;
        } catch {
          return undefined;
        }
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return undefined;
    } else {
      throw e;
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

    // lookup the project type
    const projType = projectType(project.config?.project?.[kProjectType]);
    const projOutputFile = projType.outputFile
      ? projType.outputFile(href, format, project)
      : undefined;

    const [hrefDir, hrefStem] = dirAndStem(href);
    const outputFile = projOutputFile || formatOutputFile(format) ||
      `${hrefStem}.html`;
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
): Promise<{ file: string; format: Format } | undefined> {
  // compute output dir
  const outputDir = projectOutputDir(project);

  // full path to output (it's relative to output dir)
  output = isAbsolute(output) ? output : join(outputDir, output);

  if (project.outputNameIndex !== undefined) {
    return project.outputNameIndex.get(output);
  }

  project.outputNameIndex = new Map();
  for (const file of project.files.input) {
    const inputRelative = relative(project.dir, file);
    const index = await inputTargetIndex(
      project,
      relative(project.dir, file),
    );
    if (index) {
      Object.keys(index.formats).forEach((key) => {
        const format = index.formats[key];
        const outputFile = formatOutputFile(format);
        if (outputFile) {
          const formatOutputPath = join(
            outputDir!,
            dirname(inputRelative),
            outputFile,
          );
          project.outputNameIndex!.set(formatOutputPath, { file, format });
        }
      });
    }
  }
  return project.outputNameIndex.get(output);
}

export async function inputTargetIndexForOutputFile(
  project: ProjectContext,
  outputRelative: string,
) {
  const input = await inputFileForOutputFile(project, outputRelative);
  if (!input) {
    return undefined;
  }
  return await inputTargetIndex(
    project,
    relative(project.dir, input.file),
  );
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
