/*
* update-pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
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

export function updatePandoc() {
  return new Command()
    .name("update-pandoc")
    .arguments("[version:string]")
    .description("Updates Pandoc to the specified version")
    .action(async (_args, version) => {
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
      });

      // Configure this version of pandoc
      await configureDependency(pandocDependency, configuration);

      // Generate templates
      await writePandocTemplates(configuration);
    });
}

async function writePandocTemplates(config: Configuration) {
  info("Reading latest pandoc templates...");
  const formatSrcDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
  );
  const binPath = config.directoryInfo.bin;
  const formatTemplates = [{
    pandoc: "html",
    output: join(
      formatSrcDir,
      "html",
      "pandoc",
      "html.template",
    ),
  }, {
    pandoc: "revealjs",
    output: join(formatSrcDir, "revealjs", "pandoc", "revealjs.template"),
  }, {
    pandoc: "latex",
    output: join(formatSrcDir, "pdf", "pandoc", "latex.template"),
  }];
  for (const temp of formatTemplates) {
    info(`> ${temp.pandoc}`);
    const template = await readTemplate(temp.pandoc, binPath);
    if (template) {
      ensureDirSync(dirname(temp.output));
      Deno.writeTextFileSync(temp.output, template);
    } else {
      throw new Error("Failed to read an expected template.");
    }
  }
  info("done.");
  info("");
}

async function readTemplate(format: string, bin: string): Promise<string> {
  const result = await execProcess({
    cmd: [join(bin, "tools", "pandoc"), "--print-default-template", format],
    stdout: "piped",
    stderr: "piped",
  });

  if (result.success) {
    if (result.stdout) {
      return result.stdout;
    } else {
      return "";
    }
  } else {
    throw new Error(
      `Failed to read default template for ${format} from Pandoc`,
    );
  }
}
