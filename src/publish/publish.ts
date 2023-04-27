/*
 * publish.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "../core/lodash.ts";

import { existsSync, walkSync } from "fs/mod.ts";

import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "path/mod.ts";

import {
  InputMetadata,
  PublishFiles,
  PublishProvider,
} from "./provider-types.ts";

import { AccountToken } from "./provider-types.ts";

import { PublishOptions } from "./types.ts";

import { render } from "../command/render/render-shared.ts";
import { renderServices } from "../command/render/render-services.ts";
import { projectOutputDir } from "../project/project-shared.ts";
import { PublishRecord } from "../publish/types.ts";
import { ProjectContext } from "../project/types.ts";
import { renderProgress } from "../command/render/render-info.ts";
import { inspectConfig, isDocumentConfig } from "../quarto-core/inspect.ts";
import { kOutputFile, kTitle } from "../config/constants.ts";
import { inputFilesDir } from "../core/render.ts";
import {
  writeProjectPublishDeployment,
  writePublishDeployment,
} from "./config.ts";
import { websiteTitle } from "../project/types/website/website-config.ts";
import { gfmAutoIdentifier } from "../core/pandoc/pandoc-id.ts";
import { RenderResultFile } from "../command/render/types.ts";
import { isHtmlContent, isPdfContent } from "../core/mime.ts";
import { RenderFlags } from "../command/render/types.ts";
import { normalizePath } from "../core/path.ts";

export const kSiteContent = "site";
export const kDocumentContent = "document";

export async function publishSite(
  project: ProjectContext,
  provider: PublishProvider,
  account: AccountToken,
  options: PublishOptions,
  target?: PublishRecord,
) {
  // create render function
  const renderForPublish = async (
    flags?: RenderFlags,
  ): Promise<PublishFiles> => {
    let metadataByInput: Record<string, InputMetadata> = {};

    if (options.render) {
      renderProgress("Rendering for publish:\n");
      const services = renderServices();
      try {
        const result = await render(project.dir, {
          services,
          flags,
          setProjectDir: true,
        });

        metadataByInput = result.files.reduce(
          // deno-lint-ignore no-explicit-any
          (accumulatedResult: any, currentInput) => {
            const key: string = currentInput.input as string;
            accumulatedResult[key] = {
              title: currentInput.format.metadata.title,
              author: currentInput.format.metadata.author,
              date: currentInput.format.metadata.date,
            };
            return accumulatedResult;
          },
          {},
        );

        if (result.error) {
          throw result.error;
        }
      } finally {
        services.cleanup();
      }
    }
    // return PublishFiles
    const outputDir = projectOutputDir(project);
    const files: string[] = [];
    for (const walk of walkSync(outputDir)) {
      if (walk.isFile) {
        files.push(relative(outputDir, walk.path));
      }
    }
    return normalizePublishFiles({
      baseDir: outputDir,
      rootFile: "index.html",
      files,
      metadataByInput,
    });
  };

  // publish
  const siteTitle = websiteTitle(project.config) || basename(project.dir);
  const siteSlug = gfmAutoIdentifier(siteTitle, false);
  const [publishRecord, siteUrl] = await provider.publish(
    account,
    kSiteContent,
    project.dir,
    siteTitle,
    siteSlug,
    renderForPublish,
    options,
    target,
  );
  if (publishRecord) {
    // write publish record if the id wasn't explicitly provided
    if (options.id === undefined) {
      writeProjectPublishDeployment(
        project,
        provider.name,
        account,
        publishRecord,
      );
    }
  }

  // return url
  return siteUrl;
}

export async function publishDocument(
  document: string,
  provider: PublishProvider,
  account: AccountToken,
  options: PublishOptions,
  target?: PublishRecord,
) {
  // establish title
  let title = basename(document, extname(document));
  const fileConfig = await inspectConfig(document);
  if (isDocumentConfig(fileConfig)) {
    title = (Object.values(fileConfig.formats)[0].metadata[kTitle] ||
      title) as string;
  }

  // create render function
  const renderForPublish = async (
    flags?: RenderFlags,
  ): Promise<PublishFiles> => {
    const files: string[] = [];
    if (options.render) {
      renderProgress("Rendering for publish:\n");
      const services = renderServices();
      try {
        const result = await render(document, {
          services,
          flags,
        });
        if (result.error) {
          throw result.error;
        }

        // convert the result to be document relative (if the file was in a project
        // then it will be project relative, which doesn't conform to the expectations
        // of downstream code)
        if (result.baseDir) {
          result.baseDir = normalizePath(result.baseDir);
          const docDir = normalizePath(dirname(document));
          if (result.baseDir !== docDir) {
            const docRelative = (file: string) => {
              if (!isAbsolute(file)) {
                file = join(result.baseDir!, file);
              }
              return relative(docDir, file);
            };
            result.files = result.files.map((resultFile) => {
              return {
                ...resultFile,
                file: docRelative(resultFile.file),
                supporting: resultFile.supporting
                  ? resultFile.supporting.map(docRelative)
                  : undefined,
                resourceFiles: resultFile.resourceFiles.map(docRelative),
              };
            });
            result.baseDir = docDir;
          }
        }

        // populate files
        const baseDir = result.baseDir || dirname(document);
        const asRelative = (file: string) => {
          if (isAbsolute(file)) {
            return relative(baseDir, file);
          } else {
            return file;
          }
        };

        // When publishing a document, try using an HTML or PDF
        // document as the rootFile, if one isn't present, just take
        // the first one
        const findRootFile = (files: RenderResultFile[]) => {
          const rootFile = files.find((renderResult) => {
            return isHtmlContent(renderResult.file);
          }) || files.find((renderResult) => {
            return isPdfContent(renderResult.file);
          }) || files[0];

          if (rootFile) {
            return asRelative(rootFile.file);
          } else {
            return undefined;
          }
        };

        const rootFile: string | undefined = findRootFile(result.files);
        for (const resultFile of result.files) {
          const file = asRelative(resultFile.file);
          files.push(file);
          if (resultFile.supporting) {
            files.push(
              ...resultFile.supporting
                .map((sf) => {
                  if (!isAbsolute(sf)) {
                    return join(baseDir, sf);
                  } else {
                    return sf;
                  }
                })
                .map(asRelative),
            );
          }
          files.push(...resultFile.resourceFiles.map(asRelative));
        }
        return normalizePublishFiles({
          baseDir: result.outputDir ? join(baseDir, result.outputDir) : baseDir,
          rootFile: rootFile!,
          files,
        });
      } finally {
        services.cleanup();
      }
    } else {
      // not rendering so we inspect
      const baseDir = dirname(document);
      if (isDocumentConfig(fileConfig)) {
        // output files
        let rootFile: string | undefined;
        for (const format of Object.values(fileConfig.formats)) {
          title = (format.metadata[kTitle] || title) as string;
          const outputFile = format.pandoc[kOutputFile];
          if (outputFile && existsSync(join(baseDir, outputFile))) {
            files.push(outputFile);
            if (!rootFile) {
              rootFile = outputFile;
            }
          } else {
            throw new Error(`Output file ${outputFile} does not exist.`);
          }
        }
        // filesDir (if it exists)
        const filesDir = inputFilesDir(document);
        if (existsSync(filesDir)) {
          files.push(filesDir);
        }
        // resources
        files.push(...fileConfig.resources);
        // return
        return normalizePublishFiles({
          baseDir,
          rootFile: rootFile!,
          files,
        });
      } else {
        throw new Error(
          `The specifed document (${document}) is not a valid quarto input file`,
        );
      }
    }
  };

  // publish
  const [publishRecord, siteUrl] = await provider.publish(
    account,
    kDocumentContent,
    document,
    title,
    gfmAutoIdentifier(title, false),
    renderForPublish,
    options,
    target,
  );
  if (publishRecord) {
    // write publish record if the id wasn't explicitly provided
    if (options.id === undefined) {
      writePublishDeployment(document, provider.name, account, publishRecord);
    }
  }

  // return url
  return siteUrl;
}

function normalizePublishFiles(publishFiles: PublishFiles) {
  publishFiles.files = publishFiles.files.reduce((files, file) => {
    const filePath = join(publishFiles.baseDir, file);
    if (Deno.statSync(filePath).isDirectory) {
      for (const walk of walkSync(filePath)) {
        if (walk.isFile) {
          files.push(relative(publishFiles.baseDir, walk.path));
        }
      }
    } else {
      files.push(file);
    }
    return files;
  }, new Array<string>());
  publishFiles.files = ld.uniq(publishFiles.files) as string[];
  return publishFiles;
}
