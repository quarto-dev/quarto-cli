/*
* update-pandoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { dirname, join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { info } from "log/mod.ts";

import {
  Configuration,
  readConfiguration,
  withWorkingDir,
} from "../common/config.ts";
import { lines } from "../../../src/core/text.ts";
import { pandoc } from "./dependencies/pandoc.ts";
import { archiveBinaryDependency } from "./archive-binary-dependencies.ts";

import { execProcess } from "../../../src/core/process.ts";
import { configureDependency } from "./dependencies/dependencies.ts";
import { download, unzip } from "../util/utils.ts";

export function updatePandoc() {
  return new Command()
    .name("update-pandoc")
    .arguments("<version:string>")
    .description("Updates Pandoc to the specified version")
    .action(async (_args, version: string) => {
      info(`Updating Pandoc to ${version}`);

      const configuration = readConfiguration();

      // Update the configuration file
      info("  updating configuration file.");
      const configFilePath = join(
        configuration.directoryInfo.root,
        "configuration",
      );
      const configText = Deno.readTextFileSync(configFilePath);
      const configLines = lines(configText);
      const outputLines: string[] = [];
      for (const line of configLines) {
        if (line.startsWith("export PANDOC=")) {
          outputLines.push(`export PANDOC=${version}`);
        } else {
          outputLines.push(line);
        }
      }
      Deno.writeTextFileSync(configFilePath, outputLines.join("\n"));

      const pandocDependency = pandoc(version);

      // Call archive-bin-deps for this file
      await withWorkingDir(async (workingDir) => {
        await archiveBinaryDependency(pandocDependency, workingDir);

        // Configure this version of pandoc
        await configureDependency(pandocDependency, configuration);

        // Generate templates
        await writePandocTemplates(configuration, version, workingDir);
      });
    });
}

async function writePandocTemplates(
  config: Configuration,
  version: string,
  workingDir: string,
) {
  info("Reading pandoc templates...");
  const formatSrcDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
  );

  const srcZipUrl =
    `https://github.com/jgm/pandoc/archive/refs/tags/${version}.zip`;

  const pandocDir = `pandoc-${version}`;
  const zipFile = join(workingDir, "pandoc");
  await download(srcZipUrl, zipFile);
  await unzip(zipFile, workingDir);

  // Jats templates are multi-part templates that
  // are not properly emitted by pandoc itself, so download
  // them from source instead
  const templateDir = join(workingDir, pandocDir, "data", "templates");
  const jatsOutDir = join(
    formatSrcDir,
    "jats",
    "pandoc",
    "default-templates",
  );
  const htmlOutdir = join(
    formatSrcDir,
    "html",
    "pandoc",
  );
  const latexOutdir = join(formatSrcDir, "pdf", "pandoc");
  const revealOutdir = join(formatSrcDir, "revealjs", "pandoc");

  const templateDirFiles: Record<string, Array<{ from: string; to?: string }>> =
    {
      [jatsOutDir]: [
        { from: "affiliations.jats" },
        { from: "article.jats_publishing" },
        { from: "default.jats_archiving" },
        { from: "default.jats_articleauthoring" },
        { from: "default.jats_publishing" },
      ],
      [htmlOutdir]: [
        { from: "default.html5", to: "html.template" },
      ],
      [revealOutdir]: [
        { from: "default.revealjs", to: "revealjs.template" },
      ],
      [latexOutdir]: [
        { from: "default.latex", to: "latex.template" },
      ],
    };

  // Move templates
  for (const outDir of Object.keys(templateDirFiles)) {
    ensureDirSync(outDir);
    for (const file of templateDirFiles[outDir]) {
      info(`> ${file.from}`);
      Deno.copyFileSync(
        join(templateDir, file.from),
        join(outDir, file.to || file.from),
      );
    }
  }

  info("done.");
  info("");
}
