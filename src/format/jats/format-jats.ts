/*
 * format-jats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kClearHiddenClasses,
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

import { formatResourcePath } from "../../core/resources.ts";
import { RenderServices } from "../../command/render/types.ts";
import {
  jatsDtd,
  JatsRenderSubArticle,
  JatsSubArticle,
  jatsTagset,
  kJatsSubarticle,
  kLintXml,
  subarticleTemplatePath,
  xmlPlaceholder,
} from "./format-jats-types.ts";
import { mergeConfigs } from "../../core/config.ts";

import { dirname, join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import {
  moveSubarticleSupportingPostProcessor,
  reformatXmlPostProcessor,
  renderSubarticlePostProcessor,
} from "./format-jats-postprocess.ts";

const kJatsExtended = "jats-extended";
const kJatsDtd = "jats-dtd";
const kElementsVariant = "+element_citations";

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
      services: RenderServices,
      _offset?: string,
      project?: ProjectContext,
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
      const subArticlesToRender: JatsRenderSubArticle[] = [];
      if (internalMetadata) {
        const subArticles = (internalMetadata[
          kSubArticles
        ]) as Array<JatsSubArticle | JatsRenderSubArticle> | undefined;

        if (subArticles) {
          subArticles.forEach((subArticle) => {
            if (!subArticle.render) {
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
            } else {
              // Inject a placeholder
              const placeholder = xmlPlaceholder(
                subArticle.token,
                subArticle.input,
              );
              const placeholderFile = services.temp.createFile({
                suffix: ".placeholder.xml",
              });
              Deno.writeTextFileSync(placeholderFile, placeholder);

              afterBody.push(placeholderFile);
              subArticlesToRender.push(subArticle);
            }
          });
        }
      }

      const postprocessors = [];

      // Move subarticle supporting files
      if (subArticleSupporting.length > 0) {
        postprocessors.push(
          moveSubarticleSupportingPostProcessor(subArticleSupporting),
        );
      }

      // Render subarticles and place them in the root article in the correct position
      if (subArticlesToRender.length > 0) {
        postprocessors.push(
          renderSubarticlePostProcessor(subArticlesToRender, services, project),
        );
      }

      // Lint the XML
      if (format.metadata[kLintXml] !== false) {
        postprocessors.push(reformatXmlPostProcessor);
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

export const resolveEmbeddedSubarticles = (
  format: Format,
  subArticles: Array<JatsSubArticle | JatsRenderSubArticle>,
) => {
  format.metadata = mergeConfigs(format.metadata, {
    [kQuartoInternal]: {
      [kSubArticles]: subArticles,
    },
  });
};

export const resolveJatsSubarticleMetadata = (
  format: Format,
  subArticleId: string,
) => {
  // Use the subarticle template
  format.pandoc.template = subarticleTemplatePath;

  // Configure the JATS rendering
  format.metadata[kLintXml] = false;
  format.metadata[kJatsSubarticle] = true;
  format.metadata[kJatsSubarticleId] = subArticleId;

  // Configure keep behavior of the subarticle
  format.metadata[kClearHiddenClasses] = true;
  format.execute.echo = true;
};
