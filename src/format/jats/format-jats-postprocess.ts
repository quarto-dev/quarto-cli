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
) => {
  return async (output: string) => {
    for (const subArticle of subArticles) {
      // Render the JATS to a subarticle XML file
      const [_dir, stem] = dirAndStem(output);
      const outputFile = `${stem}.subarticle.xml`;

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
        },
      );

      // There should be only one file. Grab it, and replace the placeholder
      // in the document with the rendered XML file, then delete it.
      if (rendered.files.length === 1) {
        const file = rendered.files[0];
        const placeholder = xmlPlaceholder(
          subArticle.token,
          subArticle.input,
        );

        // Read the subarticle
        const contents = Deno.readTextFileSync(file.file);
        const outputContents = Deno.readTextFileSync(output);

        // Replace the placeholder with the rendered subarticle
        const replaced = outputContents.replaceAll(placeholder, contents);
        Deno.writeTextFileSync(output, replaced);

        // Clean any output file
        Deno.removeSync(file.file);
      } else {
        throw new Error(
          "Rendered a single subarticle, but there was more than one!",
        );
      }
    }
  };
};
