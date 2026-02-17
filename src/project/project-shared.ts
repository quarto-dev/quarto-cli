/*
 * project-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, safeRemoveSync } from "../deno_ral/fs.ts";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  SEP_PATTERN,
} from "../deno_ral/path.ts";
import { kHtmlMathMethod } from "../config/constants.ts";
import { Format, Metadata } from "../config/types.ts";
import { mergeConfigs } from "../core/config.ts";
import { getFrontMatterSchema } from "../core/lib/yaml-schema/front-matter.ts";

import { normalizePath, pathWithForwardSlashes } from "../core/path.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import {
  FileInclusion,
  FileInformation,
  kProjectOutputDir,
  kProjectType,
  ProjectConfig,
  ProjectContext,
} from "./types.ts";
import { projectType } from "./types/project-types.ts";
import { ProjectType } from "./types/types.ts";
import { kWebsite } from "./types/website/website-constants.ts";
import { existsSync1 } from "../core/file.ts";
import { kManuscriptType } from "./types/manuscript/manuscript-types.ts";
import { expandIncludes } from "../core/handlers/base.ts";
import { MappedString, mappedStringFromFile } from "../core/mapped-text.ts";
import { createTempContext } from "../core/temp.ts";
import { RenderContext, RenderFlags } from "../command/render/types.ts";
import { LanguageCellHandlerOptions } from "../core/handlers/types.ts";
import { ExecutionEngineInstance } from "../execute/types.ts";
import { InspectedMdCell } from "../inspect/inspect-types.ts";
import { breakQuartoMd, QuartoMdCell } from "../core/lib/break-quarto-md.ts";
import { partitionCellOptionsText } from "../core/lib/partition-cell-options.ts";
import { parse } from "../core/yaml.ts";
import { mappedIndexToLineCol } from "../core/lib/mapped-text.ts";
import { normalizeNewlines } from "../core/lib/text.ts";
import { DirectiveCell } from "../core/lib/break-quarto-md-types.ts";
import { QuartoJSONSchema, readYamlFromMarkdown } from "../core/yaml.ts";
import { refSchema } from "../core/lib/yaml-schema/common.ts";
import { Zod } from "../resources/types/zod/schema-types.ts";
import {
  Brand,
  LightDarkBrand,
  LightDarkBrandDarkFlag,
  splitUnifiedBrand,
} from "../core/brand/brand.ts";
import { assert } from "testing/asserts";
import { Cloneable, safeCloneDeep } from "../core/safe-clone-deep.ts";

export function projectExcludeDirs(context: ProjectContext): string[] {
  const outputDir = projectOutputDir(context);
  if (outputDir) {
    return [outputDir];
  } else {
    return [];
  }
}

export function projectFormatOutputDir(
  format: Format,
  context: ProjectContext,
  type: ProjectType,
) {
  const projOutputDir = projectOutputDir(context);
  if (type.formatOutputDirectory) {
    const formatOutputDir = type.formatOutputDirectory(format);
    if (formatOutputDir) {
      return join(projOutputDir, formatOutputDir);
    } else {
      return projOutputDir;
    }
  } else {
    return projOutputDir;
  }
}

export function projectOutputDir(context: ProjectContext): string {
  let outputDir = context.config?.project[kProjectOutputDir];
  if (outputDir) {
    if (!isAbsolute(outputDir)) {
      outputDir = join(context.dir, outputDir);
    }
  } else {
    outputDir = context.dir;
  }
  if (existsSync(outputDir!)) {
    return normalizePath(outputDir!);
  } else {
    return outputDir!;
  }
}

export function hasProjectOutputDir(context: ProjectContext): boolean {
  return !!context.config?.project[kProjectOutputDir];
}

export function isProjectInputFile(path: string, context: ProjectContext) {
  if (existsSync(path)) {
    const renderPath = normalizePath(path);
    return context.files.input.map((file) => normalizePath(file)).includes(
      renderPath,
    );
  } else {
    return false;
  }
}

export function projectConfigFile(dir: string): string | undefined {
  return ["_quarto.yml", "_quarto.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync1);
}

export function projectVarsFile(dir: string): string | undefined {
  return ["_variables.yml", "_variables.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync1);
}

export function projectOffset(context: ProjectContext, input: string) {
  const projDir = normalizePath(context.dir);
  const inputDir = normalizePath(dirname(input));
  const offset = relative(inputDir, projDir) || ".";
  return pathWithForwardSlashes(offset);
}

export function toInputRelativePaths(
  type: ProjectType,
  baseDir: string,
  inputDir: string,
  collection: Array<unknown> | Record<string, unknown>,
  ignoreResources?: string[],
) {
  const existsCache = new Map<string, string>();
  const resourceIgnoreFields = ignoreResources ||
    ignoreFieldsForProjectType(type) || [];
  const offset = relative(inputDir, baseDir);

  const fixup = (value: string) => {
    // if this is a valid file, then transform it to be relative to the input path
    if (!existsCache.has(value)) {
      const projectPath = join(baseDir, value);
      try {
        if (existsSync(projectPath)) {
          existsCache.set(
            value,
            pathWithForwardSlashes(join(offset!, value)),
          );
        } else {
          existsCache.set(value, value);
        }
      } catch {
        existsCache.set(value, value);
      }
    }
    return existsCache.get(value);
  };

  const inner = (
    collection: Array<unknown> | Record<string, unknown>,
    parentKey?: unknown,
  ) => {
    if (Array.isArray(collection)) {
      for (let index = 0; index < collection.length; ++index) {
        const value = collection[index];
        if (Array.isArray(value) || value instanceof Object) {
          inner(value as Array<unknown>);
        } else if (typeof value === "string") {
          if (value.length > 0 && !isAbsolute(value)) {
            collection[index] = fixup(value);
          }
        }
      }
    } else {
      for (const index of Object.keys(collection)) {
        const value = collection[index];
        if (
          (parentKey === kHtmlMathMethod && index === "method") ||
          resourceIgnoreFields!.includes(index)
        ) {
          // don't fixup html-math-method
        } else if (Array.isArray(value) || value instanceof Object) {
          // deno-lint-ignore no-explicit-any
          inner(value as any, index);
        } else if (typeof value === "string") {
          if (value.length > 0 && !isAbsolute(value)) {
            collection[index] = fixup(value);
          }
        }
      }
    }
  };

  inner(collection);
  return collection;
}

export function ignoreFieldsForProjectType(type?: ProjectType) {
  const resourceIgnoreFields = type
    ? ["project"].concat(
      type.resourceIgnoreFields ? type.resourceIgnoreFields() : [],
    )
    : [] as string[];
  return resourceIgnoreFields;
}

export function projectIsWebsite(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projectTypeIsWebsite(projType);
  } else {
    return false;
  }
}

export function projectIsManuscript(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === kManuscriptType;
  } else {
    return false;
  }
}

export function projectPreviewServe(context?: ProjectContext) {
  return context?.config?.project?.preview?.serve;
}

export function projectIsServeable(context?: ProjectContext): boolean {
  return projectIsWebsite(context) || projectIsManuscript(context) ||
    !!projectPreviewServe(context);
}

export function projectTypeIsWebsite(projType: ProjectType): boolean {
  return projType.type === kWebsite || projType.inheritsType === kWebsite;
}

export function projectIsBook(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === "book";
  } else {
    return false;
  }
}

export function deleteProjectMetadata(metadata: Metadata) {
  // see if the active project type wants to filter the config printed
  const projType = projectType(
    (metadata as ProjectConfig).project?.[kProjectType],
  );
  if (projType.metadataFields) {
    for (const field of projType.metadataFields().concat("project")) {
      if (typeof field === "string") {
        delete metadata[field];
      } else {
        for (const key of Object.keys(metadata)) {
          if (field.test(key)) {
            delete metadata[key];
          }
        }
      }
    }
  }

  // remove project config
  delete metadata.project;
}

export function normalizeFormatYaml(yamlFormat: unknown) {
  if (yamlFormat) {
    if (typeof yamlFormat === "string") {
      yamlFormat = {
        [yamlFormat]: {},
      };
    } else if (typeof yamlFormat === "object") {
      const formats = Object.keys(yamlFormat);
      for (const format of formats) {
        if (
          (yamlFormat as Record<string, unknown>)[format] === "default"
        ) {
          (yamlFormat as Record<string, unknown>)[format] = {};
        }
      }
    }
  }
  return (yamlFormat || {}) as Record<string, unknown>;
}
export async function directoryMetadataForInputFile(
  project: ProjectContext,
  inputDir: string,
) {
  const projectDir = project.dir;
  // Finds a metadata file in a directory
  const metadataFile = (dir: string) => {
    return ["_metadata.yml", "_metadata.yaml"]
      .map((file) => join(dir, file))
      .find(existsSync1);
  };

  // The path from the project dir to the input dir
  const relativePath = relative(projectDir, inputDir);
  const dirs = relativePath.split(SEP_PATTERN);

  // The config we'll ultimately return
  let config = {};

  // Walk through each directory (starting from the project and
  // walking deeper to the input)
  let currentDir = projectDir;
  const frontMatterSchema = await getFrontMatterSchema();
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    currentDir = join(currentDir, dir);
    const file = metadataFile(currentDir);
    if (file) {
      // There is a metadata file, read it and merge it
      // Note that we need to convert paths that are relative
      // to the metadata file to be relative to input
      const errMsg = "Directory metadata validation failed for " + file + ".";
      const yaml = ((await readAndValidateYamlFromFile(
        file,
        frontMatterSchema,
        errMsg,
      )) || {}) as Record<string, unknown>;

      // resolve format into expected structure
      if (yaml.format) {
        yaml.format = normalizeFormatYaml(yaml.format);
      }

      config = mergeConfigs(
        config,
        toInputRelativePaths(
          projectType(project?.config?.project?.[kProjectType]),
          currentDir,
          inputDir,
          yaml as Record<string, unknown>,
        ),
      );
    }
  }

  return config;
}

const mdForFile = async (
  _project: ProjectContext,
  engine: ExecutionEngineInstance | undefined,
  file: string,
): Promise<MappedString> => {
  if (engine) {
    return await engine.markdownForFile(file);
  } else {
    // Last resort, just read the file
    return Promise.resolve(mappedStringFromFile(file));
  }
};

export async function projectResolveCodeCellsForFile(
  project: ProjectContext,
  engine: ExecutionEngineInstance | undefined,
  file: string,
  markdown?: MappedString,
  force?: boolean,
): Promise<InspectedMdCell[]> {
  const cache = ensureFileInformationCache(project, file);
  if (!force && cache.codeCells) {
    return cache.codeCells || [];
  }
  if (!markdown) {
    markdown = await mdForFile(project, engine, file);
  }

  const result: InspectedMdCell[] = [];
  const fileStack: string[] = [];

  const inner = async (file: string, cells: QuartoMdCell[]) => {
    if (fileStack.includes(file)) {
      throw new Error(
        "Circular include detected:\n  " + fileStack.join(" ->\n  "),
      );
    }
    fileStack.push(file);
    for (const cell of cells) {
      if (typeof cell.cell_type === "string") {
        continue;
      }
      if (cell.cell_type.language === "_directive") {
        const directiveCell = cell.cell_type as DirectiveCell;
        if (directiveCell.name !== "include") {
          continue;
        }
        const arg = directiveCell.shortcode.params[0];
        const paths = arg.startsWith("/")
          ? [project.dir, arg]
          : [project.dir, relative(project.dir, dirname(file)), arg];
        const innerFile = join(...paths);
        await inner(
          innerFile,
          (await breakQuartoMd(
            await mdForFile(project, engine, innerFile),
          )).cells,
        );
      }
      if (
        cell.cell_type.language !== "_directive"
      ) {
        const cellOptions = partitionCellOptionsText(
          cell.cell_type.language,
          cell.sourceWithYaml ?? cell.source,
        );
        const metadata = cellOptions.yaml
          ? parse(cellOptions.yaml.value, {
            schema: QuartoJSONSchema,
          }) as Record<string, unknown>
          : {};
        const lineLocator = mappedIndexToLineCol(cell.sourceVerbatim);
        result.push({
          start: lineLocator(0).line,
          end: lineLocator(cell.sourceVerbatim.value.length - 1).line,
          file: file,
          source: normalizeNewlines(cell.source.value),
          language: cell.cell_type.language,
          metadata,
        });
      }
    }
    fileStack.pop();
  };
  await inner(file, (await breakQuartoMd(markdown)).cells);
  cache.codeCells = result;
  return result;
}

export async function projectFileMetadata(
  project: ProjectContext,
  file: string,
  force?: boolean,
): Promise<Metadata> {
  const cache = ensureFileInformationCache(project, file);
  if (!force && cache.metadata) {
    return cache.metadata;
  }
  const { engine } = await project.fileExecutionEngineAndTarget(file);
  const markdown = await mdForFile(project, engine, file);
  const metadata = readYamlFromMarkdown(markdown.value);
  cache.metadata = metadata;
  return metadata;
}

export async function projectResolveFullMarkdownForFile(
  project: ProjectContext,
  engine: ExecutionEngineInstance | undefined,
  file: string,
  markdown?: MappedString,
  force?: boolean,
): Promise<MappedString> {
  const cache = ensureFileInformationCache(project, file);
  if (!force && cache.fullMarkdown) {
    return cache.fullMarkdown;
  }

  const temp = createTempContext();

  if (!markdown) {
    markdown = await mdForFile(project, engine, file);
  }

  const options: LanguageCellHandlerOptions = {
    name: "",
    temp,
    stage: "pre-engine",
    format: undefined as unknown as Format,
    markdown,
    context: {
      project,
      target: {
        source: file,
      },
    } as unknown as RenderContext,
    flags: {} as RenderFlags,
  };
  try {
    const result = await expandIncludes(markdown, options, file);
    cache.fullMarkdown = result;
    cache.includeMap = options.state?.include.includes as FileInclusion[];
    return result;
  } finally {
    temp.cleanup();
  }
}

export const ensureFileInformationCache = (
  project: ProjectContext,
  file: string,
) => {
  if (!project.fileInformationCache) {
    project.fileInformationCache = new FileInformationCacheMap();
  }
  assert(
    project.fileInformationCache instanceof Map,
    JSON.stringify(project.fileInformationCache),
  );
  if (!project.fileInformationCache.has(file)) {
    project.fileInformationCache.set(file, {} as FileInformation);
  }
  return project.fileInformationCache.get(file)!;
};

export async function projectResolveBrand(
  project: ProjectContext,
  fileName?: string,
): Promise<LightDarkBrandDarkFlag | undefined> {
  async function loadSingleBrand(brandPath: string): Promise<Brand> {
    const brand = await readAndValidateYamlFromFile(
      brandPath,
      refSchema("brand-single", "Format-independent brand configuration."),
      "Brand validation failed for " + brandPath + ".",
    );
    return new Brand(brand, dirname(brandPath), project.dir);
  }
  async function loadUnifiedBrand(
    brandPath: string,
  ): Promise<LightDarkBrandDarkFlag> {
    const brand = await readAndValidateYamlFromFile(
      brandPath,
      refSchema("brand-unified", "Format-independent brand configuration."),
      "Brand validation failed for " + brandPath + ".",
    );
    return splitUnifiedBrand(brand, dirname(brandPath), project.dir);
  }
  function resolveBrandPath(
    brandPath: string,
    dir: string = dirname(fileName!),
  ): string {
    let resolved: string = "";
    if (brandPath.startsWith("/")) {
      resolved = join(project.dir, brandPath);
    } else {
      resolved = join(dir, brandPath);
    }
    return resolved;
  }
  if (fileName === undefined) {
    if (project.brandCache) {
      return project.brandCache.brand;
    }
    project.brandCache = {};
    let fileNames = [
      "_brand.yml",
      "_brand.yaml",
      "_brand/_brand.yml",
      "_brand/_brand.yaml",
    ].map((file) => join(project.dir, file));
    const brand = (project?.config?.brand ??
      project?.config?.project.brand) as
        | boolean
        | string
        | {
          light?: string;
          dark?: string;
        };
    if (brand === false) {
      project.brandCache.brand = undefined;
      return project.brandCache.brand;
    }
    if (
      typeof brand === "object" && brand &&
      ("light" in brand || "dark" in brand)
    ) {
      project.brandCache.brand = {
        light: brand.light
          ? await loadSingleBrand(resolveBrandPath(brand.light, project.dir))
          : undefined,
        dark: brand.dark
          ? await loadSingleBrand(resolveBrandPath(brand.dark, project.dir))
          : undefined,
        enablesDarkMode: !!brand.dark,
      };
      return project.brandCache.brand;
    }
    if (typeof brand === "string") {
      fileNames = [join(project.dir, brand)];
    }

    for (const brandPath of fileNames) {
      if (!existsSync(brandPath)) {
        continue;
      }
      project.brandCache.brand = await loadUnifiedBrand(brandPath);
    }
    return project.brandCache.brand;
  } else {
    const metadata = await project.fileMetadata(fileName);
    if (metadata.brand === undefined) {
      return project.resolveBrand();
    }
    const brand = Zod.BrandPathBoolLightDark.parse(metadata.brand);
    if (brand === false) {
      return undefined;
    }
    if (brand === true) {
      return project.resolveBrand();
    }
    const fileInformation = ensureFileInformationCache(project, fileName);
    if (fileInformation.brand) {
      return fileInformation.brand;
    }
    if (typeof brand === "string") {
      fileInformation.brand = await loadUnifiedBrand(resolveBrandPath(brand));
      return fileInformation.brand;
    } else {
      assert(typeof brand === "object");
      if ("light" in brand || "dark" in brand) {
        let light, dark;
        if (typeof brand.light === "string") {
          light = await loadSingleBrand(resolveBrandPath(brand.light));
        } else if (brand.light) {
          light = new Brand(
            brand.light,
            dirname(fileName),
            project.dir,
          );
        }
        if (typeof brand.dark === "string") {
          dark = await loadSingleBrand(resolveBrandPath(brand.dark));
        } else if (brand.dark) {
          dark = new Brand(
            brand.dark,
            dirname(fileName),
            project.dir,
          );
        }
        fileInformation.brand = { light, dark, enablesDarkMode: !!dark };
      } else {
        fileInformation.brand = splitUnifiedBrand(
          brand,
          dirname(fileName),
          project.dir,
        );
      }
      return fileInformation.brand;
    }
  }
}

// A Map that normalizes path keys for cross-platform consistency.
// All path operations normalize keys (forward slashes, lowercase on Windows).
// Implements Cloneable but shares state intentionally - in preview mode,
// the project context is reused across renders and cache state must persist.
export class FileInformationCacheMap extends Map<string, FileInformation>
  implements Cloneable<Map<string, FileInformation>> {
  override get(key: string): FileInformation | undefined {
    return super.get(normalizePath(key));
  }

  override has(key: string): boolean {
    return super.has(normalizePath(key));
  }

  override set(key: string, value: FileInformation): this {
    return super.set(normalizePath(key), value);
  }

  override delete(key: string): boolean {
    return super.delete(normalizePath(key));
  }

  // Note: Iterator methods (keys(), entries(), forEach(), [Symbol.iterator])
  // return normalized keys as stored. Code iterating over the cache sees
  // normalized paths, which is consistent with how keys are stored.

  // Returns this instance (shared reference) rather than a copy.
  // This is intentional: in preview mode, project context is cloned for
  // each render but the cache must be shared so invalidations persist.
  clone(): Map<string, FileInformation> {
    return this;
  }
}

export function cleanupFileInformationCache(project: ProjectContext) {
  project.fileInformationCache.forEach((entry) => {
    if (entry?.target?.data) {
      const data = entry.target.data as {
        transient?: boolean;
      };
      if (data.transient && entry.target?.input) {
        safeRemoveSync(entry.target?.input);
      }
    }
  });
}

export async function withProjectCleanup<T>(
  project: ProjectContext,
  fn: (project: ProjectContext) => Promise<T>,
): Promise<T> {
  try {
    return await fn(project);
  } finally {
    project.cleanup();
  }
}
