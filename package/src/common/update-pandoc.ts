/*
* update-pandoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { error, info } from "../../../src/deno_ral/log.ts";

import {
  Configuration,
  readConfiguration,
  withWorkingDir,
} from "../common/config.ts";
import { lines } from "../../../src/core/text.ts";
import { pandoc } from "./dependencies/pandoc.ts";
import { archiveBinaryDependency } from "./archive-binary-dependencies.ts";

import { configureDependency } from "./dependencies/dependencies.ts";
import { download, unzip } from "../util/utils.ts";
import {
  pandocListFormatDefaultExtensions,
  pandocListFormats,
} from "../../../src/core/pandoc/pandoc-formats.ts";

import {
  bgBlack,
  bold,
  brightWhite,
} from "../../../src/core/lib/external/colors.ts";

import * as ld from "../../../src/core/lodash.ts";

import { execProcess } from "../../../src/core/process.ts";
import { pandocBinaryPath } from "../../../src/core/resources.ts";

export function updatePandoc() {
  return new Command()
    .name("update-pandoc")
    .arguments("<version:string>")
    .description("Updates Pandoc to the specified version")
    .option(
      "--skip-archive",
      "Regenerate templates and format-extension.ts without archiving to S3, configuring the binary, or updating configuration. Requires QUARTO_PANDOC to resolve to the requested version.",
    )
    // deno-lint-ignore no-explicit-any
    .action(async (options: any, version: string) => {
      info(`Updating Pandoc to ${version}`);

      const configuration = readConfiguration();
      const skipArchive = !!options.skipArchive;

      if (skipArchive) {
        // writeVariants() needs the target Pandoc binary to enumerate formats/extensions.
        const overridePath = Deno.env.get("QUARTO_PANDOC");
        if (!overridePath) {
          error(
            `QUARTO_PANDOC is not set. Set it to a Pandoc ${version} executable ` +
              "before using --skip-archive.",
          );
          throw new Error("QUARTO_PANDOC is not set");
        }

        // An unresolved QUARTO_PANDOC can fall back to the bundled binary.
        // Verify the version before generating format-extension.ts.
        let reported: string | undefined;
        try {
          reported = lines(
            (await execProcess({
              cmd: pandocBinaryPath(),
              args: ["--version"],
              stdout: "piped",
            })).stdout!,
          )[0]?.split(" ")[1];
        } catch (_e) {
          error(
            "Could not run the QUARTO_PANDOC binary to verify its version. " +
              `QUARTO_PANDOC is set to "${overridePath}". Confirm it points at a ` +
              "runnable Pandoc executable.",
          );
          throw new Error("QUARTO_PANDOC binary is not runnable");
        }
        if (
          normalizePandocVersion(reported) !== normalizePandocVersion(version)
        ) {
          error(
            `The Pandoc binary resolved via QUARTO_PANDOC reports version ` +
              `${reported}, not the requested ${version}. QUARTO_PANDOC is set to ` +
              `"${overridePath}". An unresolved override can fall back to the ` +
              `bundled binary. Set QUARTO_PANDOC to a Pandoc ${version} executable ` +
              "and retry.",
          );
          throw new Error("QUARTO_PANDOC does not resolve to the requested version");
        }
      } else {
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
      }

      await withWorkingDir(async (workingDir) => {
        if (!skipArchive) {
          const pandocDependency = pandoc(version);

          // Archive to S3
          await archiveBinaryDependency(pandocDependency, workingDir);

          await configureDependency(
            pandocDependency,
            join(configuration.directoryInfo.bin, "tools"),
            configuration,
          );
        }

        // Templates are downloaded from Pandoc's source archive on GitHub.
        await writePandocTemplates(configuration, version, workingDir);

        // Generate variants (always: uses the resolved Pandoc binary, which
        // honors QUARTO_PANDOC)
        await writeVariants(configuration);
      });

      if (skipArchive) {
        console.log(bgBlack(brightWhite(bold(
          "\n** Templates and src/core/pandoc/format-extension.ts regenerated. **" +
            "\n** Review `git diff` and port relevant upstream changes to Quarto's templates. **" +
            "\n** Configuration is unchanged. Complete dev-docs/update-pandoc-checklist.md before merging. **",
        ))));
      } else {
        console.log(bgBlack(brightWhite(bold(
          "\n** Remember to complete the checklist in /dev-docs/update-pandoc-checklist.md! **",
        ))));
      }
    });
}

// Pad a Pandoc version to at least 3 parts so "3.10" matches "3.10.0".
// Longer versions keep every part: 3.1.6.1 and 3.1.6.2 are distinct releases.
function normalizePandocVersion(version: string | undefined): string {
  if (!version) {
    return "";
  }
  const parts = version.split(".");
  if (parts.length < 3) {
    return parts.concat(Array(3 - parts.length).fill("0")).join(".");
  }
  return parts.join(".");
}

// Starting in Pandoc 3, we saw a number of variants that appear to be supported
// disappear from the --list-extensions command, so for the time being we're just
// hard adding them here
const kExtendedVariants: string[] = [
  "amuse",
  "attributes",
  "element_citations",
  "empty_paragraphs",
  "epub_html_exts",
  "native_numbering",
  "ntb",
  "raw_markdown",
  "sourcepos",
  "styles",
  "xrefs_name",
  "xrefs_number",
];

async function writeVariants(
  config: Configuration,
) {
  info("Generating Pandoc extensions source file...");
  info("Reading pandoc formats and extensions");
  const formats = await pandocListFormats();
  const extensions: Set<string> = new Set();
  for (const format of formats) {
    const formatExtensions = await pandocListFormatDefaultExtensions(format);
    formatExtensions.forEach((ext) => {
      const bareExtension = ext.replace(/^[\+\-]/, "");
      extensions.add(bareExtension);
    });
  }
  const extArr = Array.from(extensions.values());
  info(`  Pandoc Alone Reporting:`);
  info(`  ${formats.length} formats.`);
  info(`  ${extArr.length} extensions.`);

  extArr.push(...kExtendedVariants);
  const extended = ld.uniq(extArr);
  info(`  ${extended.length} extensions (after adding extended).`);

  const extArrExpanded = extended.toSorted().flatMap((ext: string) => {
    return [`"+${ext}"`, `"-${ext}"`];
  });

  const extensionFile = join(
    config.directoryInfo.src,
    "core",
    "pandoc",
    "format-extension.ts",
  );

  // Generate the extension list
  const tsContents = `
/*
* pandoc-extensions.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
//
// THIS FILE IS GENERATED BY update-pandoc.ts. DO NOT EDIT MANUALLY
//

export const kPandocExtensions = [
  ${extArrExpanded.join(",\n  ")}
];
`;

  // Write the file
  Deno.writeTextFileSync(extensionFile, tsContents);
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
  const beamerOutdir = join(formatSrcDir, "beamer", "pandoc");
  const asciidocOutdir = join(formatSrcDir, "asciidoc", "pandoc");
  const typstOutdir = join(formatSrcDir, "typst", "pandoc");

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
        { from: "styles.html", to: "html.styles" },
      ],
      [revealOutdir]: [
        { from: "default.revealjs", to: "revealjs.template" },
      ],
      [latexOutdir]: [
        { from: "default.latex", to: "latex.template" },
        // Template we need to tweak
        { from: "common.latex", to: "latex.common" },
        // Template kept unchanged
        { from: "after-header-includes.latex" },
        { from: "hypersetup.latex" },
        { from: "font-settings.latex" },
        { from: "fonts.latex" },
        { from: "passoptions.latex" },
      ],
      [beamerOutdir]: [
        { from: "default.beamer", to: "beamer.template" },
        // Template we need to tweak
        { from: "common.latex", to: "latex.common" },
        // Template kept unchanged
        { from: "after-header-includes.latex" },
        { from: "hypersetup.latex" },
        { from: "font-settings.latex" },
        { from: "fonts.latex" },
        { from: "passoptions.latex" },
      ],
      [asciidocOutdir]: [
        { from: "default.asciidoc", to: "asciidoc.template" },
      ],
      [typstOutdir]: [
        { from: "default.typst", to: "typst.template" },
        { from: "template.typst" }
      ]
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
