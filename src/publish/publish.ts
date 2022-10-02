/*
* publish.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
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

import { AccountToken, PublishFiles, PublishProvider } from "./provider.ts";

import { PublishOptions } from "./types.ts";

import { render, renderServices } from "../command/render/render-shared.ts";
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
  const renderForPublish = async (siteUrl?: string): Promise<PublishFiles> => {
    if (options.render) {
      renderProgress("Rendering for publish:\n");
      const services = renderServices();
      try {
        const result = await render(project.dir, {
          services,
          flags: {
            siteUrl,
          },
          setProjectDir: true,
        });
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
  const renderForPublish = async (): Promise<PublishFiles> => {
    const files: string[] = [];
    if (options.render) {
      renderProgress("Rendering for publish:\n");
      const services = renderServices();
      try {
        const result = await render(document, {
          services,
        });
        if (result.error) {
          throw result.error;
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
        let rootFile: string | undefined;
        for (const resultFile of result.files) {
          const file = asRelative(resultFile.file);
          if (!rootFile) {
            rootFile = file;
          }
          files.push(file);
          if (resultFile.supporting) {
            files.push(
              ...resultFile.supporting.map((sf) => Deno.realPathSync(sf)).map(
                asRelative,
              ),
            );
          }
          files.push(...resultFile.resourceFiles.map(asRelative));
        }
        return normalizePublishFiles({
          baseDir,
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
      writePublishDeployment(
        document,
        provider.name,
        account,
        publishRecord,
      );
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
