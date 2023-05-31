/*
 * format-jats-postprocess.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";
import { JatsRenderSubArticle, xmlPlaceholder } from "./format-jats-types.ts";

import { dirname, join, relative } from "path/mod.ts";
import { copySync } from "fs/copy.ts";
import { readLines } from "io/mod.ts";
import { ProjectContext } from "../../project/types.ts";
import { logProgress } from "../../core/log.ts";
import { kJatsSubarticle } from "../../render/notebook/notebook-types.ts";

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
  input: string,
  subArticles: JatsRenderSubArticle[],
  services: RenderServices,
  project?: ProjectContext,
) => {
  return async (output: string) => {
    const total = subArticles.length;
    if (subArticles.length > 0) {
      logProgress("Rendering JATS sub-articles");
    }

    let count = 0;
    for (const subArticle of subArticles) {
      const subArticlePath = subArticle.input;
      const nbRelPath = relative(dirname(input), subArticlePath);
      logProgress(`[${++count}/${total}] ${nbRelPath}`);

      let nb = services.notebook.get(subArticlePath);
      if (!nb) {
        nb = await services.notebook.render(
          subArticlePath,
          kJatsSubarticle,
          services,
          project,
        );
      }

      if (nb && nb[kJatsSubarticle]) {
        let outputContents = Deno.readTextFileSync(output);

        const jatsSubarticlePath = nb[kJatsSubarticle].path;
        const placeholder = xmlPlaceholder(
          subArticle.token,
          subArticle.input,
        );

        const subArtReader = await Deno.open(jatsSubarticlePath);
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

        Deno.writeTextFileSync(output, outputContents);

        // TODO: Push supporting / resources here
      }
    }
  };
};

const kIdRegex = /(\s+)id="([^"]*)"/g;
const kRidRegex = /(\s+)rid="([^"]*)"/g;
