/*
 * format-jats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kDefaultImageExtension,
  kIncludeAfterBody,
  kJatsSubarticleId,
  kLinkCitations,
  kQuartoInternal,
  kResources,
  kVariant,
} from "../../config/constants.ts";
import { Format, Metadata, PandocFlags } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { createFormat } from "../formats-shared.ts";

import { warning } from "log/mod.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { join, relative } from "path/mod.ts";
import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";
import { kJatsSubarticle } from "./format-jats-types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { dirname } from "../../vendor/deno.land/std@0.185.0/path/win32.ts";
import { copySync } from "../../vendor/deno.land/std@0.185.0/fs/copy.ts";

const kJatsExtended = "jats-extended";
const kJatsDtd = "jats-dtd";
const kElementsVariant = "+element_citations";
const kLintXml = "_lint-jats-xml-output";

const kSubArticles = "subarticles";

export function jatsFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    render: {
      [kVariant]: kElementsVariant,
    },
    formatExtras: (
      input: string,
      _markdown: string,
      _flags: PandocFlags,
      format: Format,
      _libDir: string,
      _services: RenderServices,
      _offset?: string,
      _project?: ProjectContext,
    ) => {
      // Provide a template and partials
      const templateDir = formatResourcePath("jats", "pandoc");
      const partials = [
        "front.xml",
        "authors.xml",
        "institution.xml",
        "name.xml",
      ];
      const templateContext = {
        template: join(templateDir, "template.xml"),
        partials: partials.map((partial) => join(templateDir, partial)),
      };

      // Which tagset we're using
      const tagset = jatsTagset(format.identifier["base-format"] || "jats");

      const metadataOverride = {
        // Link citations produces `xrefs` for the citations to the references in the bibliography so
        // must be enabled
        [kLinkCitations]: true,
      };
      // If this has been explicitly disabled, warn the user that the setting is being ignored
      if (format.metadata[kLinkCitations] === false) {
        warning(
          "JATS formats require that `link-citations` is enabled to emit well formed JATS. Explicitly set value is being ignored.",
        );
      }

      const internalMetadata = format.metadata[kQuartoInternal] as
        | Metadata
        | undefined;

      // Share resources with external
      const afterBody: string[] = [];
      const subArticleResources: string[] = [];
      const subArticleSupporting: { from: string; toRelative: string }[] = [];
      if (internalMetadata) {
        const subArticles = (internalMetadata[
          kSubArticles
        ]) as JatsSubArticle[] | undefined;

        if (subArticles) {
          subArticles.forEach((subArticle) => {
            // Inject the subarticle into the body
            afterBody.push(subArticle.output);

            // Add any resources
            subArticleResources.push(...subArticle.resources);

            // For supporting files, track them and then
            // post rendering, relocate them to the parent directory
            // as supporting files
            subArticle.supporting.forEach((supporting) => {
              const from = join(dirname(input), supporting);
              const toRelative = join(
                relative(dirname(subArticle.input), supporting),
              );
              subArticleSupporting.push({ toRelative, from });
            });
          });
        }
      }

      // Responsible for moving the supporting files
      const moveSubarticleSupportingPostProcessor = (
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

      const reformatXmlPostProcessor = async (output: string) => {
        await reformat(output);
      };

      const postprocessors = [];
      if (format.metadata[kLintXml] !== false) {
        postprocessors.push(reformatXmlPostProcessor);
      }
      if (subArticleSupporting.length > 0) {
        postprocessors.push(
          moveSubarticleSupportingPostProcessor(subArticleSupporting),
        );
      }

      return {
        [kIncludeAfterBody]: afterBody,
        metadata: {
          [kQuartoInternal]: {
            // These signal the template with flags controlling the tagset to be output
            [kJatsExtended]: tagset === "archiving" || tagset === "publishing",
            [kJatsDtd]: jatsDtd(tagset),
          },
          [kResources]: subArticleResources,
        },
        templateContext,
        metadataOverride,
        postprocessors,
      };
    },
  });
}

type JatsTagset = "archiving" | "publishing" | "authoring";
interface DTDInfo {
  name: string;
  location: string;
}

const kTagSets: Record<string, JatsTagset> = {
  "jats": "archiving",
  "jats_archiving": "archiving",
  "jats_publishing": "publishing",
  "jats_articleauthoring": "authoring",
};
function jatsTagset(to: string): JatsTagset {
  return kTagSets[to];
}

const kDJatsDtds: Record<JatsTagset, DTDInfo> = {
  "archiving": {
    name:
      "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2 20190208//EN",
    location: "JATS-archivearticle1.dtd",
  },
  "publishing": {
    name: "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.2 20190208//EN",
    location: "JATS-publishing1.dtd",
  },
  "authoring": {
    name: "-//NLM//DTD JATS (Z39.96) Article Authoring DTD v1.2 20190208//EN",
    location: "JATS-articleauthoring1.dtd",
  },
};

function jatsDtd(tagset: JatsTagset) {
  return kDJatsDtds[tagset];
}

export interface JatsSubArticle {
  input: string;
  output: string;
  supporting: string[];
  resources: string[];
}

export const resolveEmbeddedSubarticles = (
  format: Format,
  subArticles: JatsSubArticle[],
) => {
  format.metadata = mergeConfigs(format.metadata, {
    [kQuartoInternal]: { [kSubArticles]: subArticles },
  });
};

export const resolveJatsSubarticleMetadata = (
  format: Format,
  subArticleId: string,
) => {
  // Use the subarticle template
  format.pandoc.template = formatResourcePath(
    "jats",
    join("pandoc", "subarticle", "template.xml"),
  );

  // Configure the JATS rendering
  format.metadata[kLintXml] = false;
  format.metadata[kJatsSubarticle] = true;
  format.metadata[kJatsSubarticleId] = subArticleId;
};
