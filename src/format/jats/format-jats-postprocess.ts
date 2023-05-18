/*
 * format-jats-postprocess.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kJatsSubarticleId,
  kOutputFile,
  kTemplate,
  kTo,
} from "../../config/constants.ts";

import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";
import {
  JatsRenderSubArticle,
  kJatsSubarticle,
  kLintXml,
  subarticleTemplatePath,
  xmlPlaceholder,
} from "./format-jats-types.ts";
import { renderFiles } from "../../command/render/render-files.ts";
import { dirAndStem } from "../../core/path.ts";

import { dirname, join } from "path/mod.ts";
import { copySync } from "fs/copy.ts";
import { readLines } from "io/mod.ts";
import { ProjectContext } from "../../project/types.ts";

// XML Linting
export const reformatXmlPostProcessor = async (output: string) => {
  await reformat(output);
};

// Responsible for moving the supporting files
export const moveSubarticleSupportingPostProcessor = (
  supporting: { from: string; toRelative: string }[],
) => {
  return (output: string) => {
    const supportingOut: string[] = [];
    supporting.forEach((supp) => {
      const outputPath = join(dirname(output), supp.toRelative);
      copySync(supp.from, outputPath, { overwrite: true });
      supportingOut.push(outputPath);
    });
    return {
      supporting: supportingOut,
    };
  };
};

// Injects the root subarticle
export const renderSubarticlePostProcessor = (
  subArticles: JatsRenderSubArticle[],
  services: RenderServices,
  project?: ProjectContext,
) => {
  return async (output: string) => {
    for (const subArticle of subArticles) {
      // Render the JATS to a subarticle XML file
      const [_dir, stem] = dirAndStem(output);
      const outputFile = `${stem}.subarticle.xml`;

      const subArticleDir = dirname(subArticle.input);
      const rendered = await renderFiles(
        [{ path: subArticle.input, formats: ["jats"] }],
        {
          services,
          flags: {
            metadata: {
              [kTo]: "jats",
              [kLintXml]: false,
              [kJatsSubarticle]: true,
              [kJatsSubarticleId]: subArticle.token,
              [kOutputFile]: outputFile,
              [kTemplate]: subarticleTemplatePath,
            },
            quiet: true,
          },
          echo: true,
          warning: true,
        },
        [],
        undefined,
        project,
      );

      // Read the subarticle
      let outputContents = Deno.readTextFileSync(output);

      // There should be only one file. Grab it, and replace the placeholder
      // in the document with the rendered XML file, then delete it.
      if (rendered.files.length === 1) {
        const file = join(subArticleDir, rendered.files[0].file);
        const placeholder = xmlPlaceholder(
          subArticle.token,
          subArticle.input,
        );

        // Process the subarticle to deal with ids and rids
        const subArtReader = await Deno.open(file);
        const subArtLines: string[] = [];
        for await (let line of readLines(subArtReader)) {
          // Process ids (add a suffix to all ids and rids)
          line = line.replaceAll(kIdRegex, `$1id="$2-${subArticle.token}"`);
          line = line.replaceAll(kRidRegex, `$1rid="$2-${subArticle.token}"`);
          subArtLines.push(line);
        }

        // Replace the placeholder with the rendered subarticle
        outputContents = outputContents.replaceAll(
          placeholder,
          subArtLines.join("\n"),
        );

        // Clean any output file
        Deno.removeSync(file);
      } else {
        throw new Error(
          "Rendered a single subarticle, but there was more than one!",
        );
      }

      Deno.writeTextFileSync(output, outputContents);
    }
  };
};

const kIdRegex = /(\s+)id="([^"]*)"/g;
const kRidRegex = /(\s+)rid="([^"]*)"/g;
