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
      "Phase 1 prep only: regenerate templates and format-extension.ts from a QUARTO_PANDOC-provided binary without archiving to S3, configuring the binary, or bumping the configuration file. Requires QUARTO_PANDOC to point at a Pandoc <version> binary.",
    )
    // deno-lint-ignore no-explicit-any
    .action(async (options: any, version: string) => {
      info(`Updating Pandoc to ${version}`);

      const configuration = readConfiguration();
      const skipArchive = !!options.skipArchive;

      if (skipArchive) {
        // Phase 1 (prep): no S3, no configuration rewrite. Regenerate the
        // template files and format-extension.ts against a locally supplied
        // binary so nothing is hand-patched by mistake. This requires a real
        // Pandoc <version> binary resolvable via QUARTO_PANDOC, because
        // writeVariants() shells out to it to enumerate formats/extensions.
        const overridePath = Deno.env.get("QUARTO_PANDOC");
        if (!overridePath) {
          error(
            "--skip-archive requires the QUARTO_PANDOC environment variable to " +
              `point at a Pandoc ${version} binary. Without it, writeVariants() ` +
              "would regenerate src/core/pandoc/format-extension.ts from whatever " +
              "Pandoc is currently configured (likely the old version), silently " +
              "corrupting it. Download the target release and set QUARTO_PANDOC, e.g.\n" +
              `  QUARTO_PANDOC=/path/to/pandoc-${version}/bin/pandoc \\\n` +
              `    ./package/src/quarto-bld update-pandoc ${version} --skip-archive`,
          );
          throw new Error("QUARTO_PANDOC is not set");
        }

        // Fatal check: pandocBinaryPath() silently falls back to the bundled/
        // configured Pandoc (with only a warnOnce) if QUARTO_PANDOC is unset,
        // nonexistent, or otherwise fails to resolve (src/core/resources.ts
        // toolsPath()). If the resolved binary doesn't report the requested
        // version, continuing would regenerate format-extension.ts from the
        // wrong (likely old, bundled) Pandoc - the exact silent corruption
        // this flag exists to prevent - so this must fail, not warn.
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
              `QUARTO_PANDOC is set to "${overridePath}" - confirm it points at a ` +
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
              `"${overridePath}" - if that path doesn't exist or isn't a file, ` +
              "pandocBinaryPath() silently fell back to the bundled/configured " +
              "Pandoc, which would corrupt format-extension.ts if this continued. " +
              "Fix QUARTO_PANDOC and retry.",
          );
          throw new Error("QUARTO_PANDOC does not resolve to the requested version");
        }
      } else {
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
      }

      await withWorkingDir(async (workingDir) => {
        if (!skipArchive) {
          const pandocDependency = pandoc(version);

          // Archive to S3
          await archiveBinaryDependency(pandocDependency, workingDir);

          // Configure this version of pandoc
          await configureDependency(
            pandocDependency,
            join(configuration.directoryInfo.bin, "tools"),
            configuration,
          );
        }

        // Generate templates (always: downloads Pandoc's source zip from
        // GitHub, never touches S3)
        await writePandocTemplates(configuration, version, workingDir);

        // Generate variants (always: uses the resolved Pandoc binary, which
        // honors QUARTO_PANDOC)
        await writeVariants(configuration);
      });

      // print the completion message
      if (skipArchive) {
        console.log(bgBlack(brightWhite(bold(
          "\n** Phase 1 (prep) complete. **" +
            "\n** Templates and src/core/pandoc/format-extension.ts were regenerated " +
            "as an UNCOMMITTED working-tree diff - review with `git diff` and commit " +
            "yourself. **" +
            "\n** A diff in a hand-patched template or dev-reference file means " +
            "Phase 1 missed that file; a diff limited to format-extension.ts is a " +
            "normal generated change to review. **" +
            "\n** The `configuration` file is still pinned. Phase 2 (bump " +
            "`configuration` + src/command/check/check.ts, archive the binary to S3, " +
            "run the create-release.yml dry-run) must be done by an S3 credential " +
            "holder before merge. See dev-docs/update-pandoc-checklist.md. **",
        ))));
      } else {
        console.log(bgBlack(brightWhite(bold(
          "\n** Remember to complete the checklist in /dev-docs/update-pandoc-checklist.md! **",
        ))));
      }
    });
}

// Normalize a Pandoc version string to a 3-part "x.y.z" form for comparison,
// mirroring the semver-ish normalization in src/command/check/check.ts.
function normalizePandocVersion(version: string | undefined): string {
  if (!version) {
    return "";
  }
  const parts = version.split(".");
  if (parts.length > 3) {
    return parts.slice(0, 3).join(".");
  } else if (parts.length < 3) {
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
