/*
* publish.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync, walkSync } from "fs/mod.ts";

import { dirname, isAbsolute, join, relative } from "path/mod.ts";

import { AccountToken, PublishFiles, PublishProvider } from "./provider.ts";

import { PublishOptions } from "./types.ts";

import { render, renderServices } from "../command/render/render-shared.ts";
import { projectOutputDir } from "../project/project-shared.ts";
import { PublishRecord } from "../publish/types.ts";
import { ProjectContext } from "../project/types.ts";
import { renderProgress } from "../command/render/render-info.ts";
import { inspectConfig, isDocumentConfig } from "../quarto-core/inspect.ts";
import { kOutputFile } from "../config/constants.ts";
import { inputFilesDir } from "../core/render.ts";
import {
  writeProjectPublishDeployment,
  writePublishDeployment,
} from "./config.ts";

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
    return {
      baseDir: outputDir,
      rootFile: "index.html",
      files,
    };
  };

  // publish
  const [publishRecord, siteUrl] = await provider.publish(
    account,
    "site",
    renderForPublish,
    target,
  );
  if (publishRecord) {
    writeProjectPublishDeployment(
      project,
      provider.name,
      publishRecord,
    );
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
            files.push(...resultFile.supporting.map(asRelative));
          }
          files.push(...resultFile.resourceFiles.map(asRelative));
        }
        return {
          baseDir,
          rootFile: rootFile!,
          files,
        };
      } finally {
        services.cleanup();
      }
    } else {
      // not rendering so we inspect
      const baseDir = dirname(document);
      const fileConfig = await inspectConfig(document);
      if (isDocumentConfig(fileConfig)) {
        // output files
        let rootFile: string | undefined;
        for (const format of Object.values(fileConfig.formats)) {
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
        return {
          baseDir,
          rootFile: rootFile!,
          files,
        };
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
    "document",
    renderForPublish,
    target,
  );
  if (publishRecord) {
    writePublishDeployment(
      document,
      provider.name,
      publishRecord,
    );
  }

  // return url
  return siteUrl;
}
