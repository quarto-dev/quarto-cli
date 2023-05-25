/*
 * format-jats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kDefaultImageExtension,
  kIncludeAfterBody,
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
  jatsTagset,
  kJatsSubarticle,
  kLintXml,
  kSubArticles,
  xmlPlaceholder,
} from "./format-jats-types.ts";

import { join } from "path/mod.ts";
import { warning } from "log/mod.ts";
import {
  reformatXmlPostProcessor,
  renderSubarticlePostProcessor,
} from "./format-jats-postprocess.ts";

const kJatsExtended = "jats-extended";
const kJatsDtd = "jats-dtd";
const kElementsVariant = "+element_citations";

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
      const subArticlesToRender: JatsRenderSubArticle[] = [];
      if (internalMetadata && !format.metadata[kJatsSubarticle]) {
        const subArticles = (internalMetadata[
          kSubArticles
        ]) as Array<JatsRenderSubArticle> | undefined;

        // TODO: Make this one text file written instead of many
        if (subArticles) {
          subArticles.forEach((subArticle) => {
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
          });
        }
      }
      const postprocessors = [];

      // Render subarticles and place them in the root article in the correct position
      if (subArticlesToRender.length > 0 && !format.metadata[kJatsSubarticle]) {
        postprocessors.push(
          renderSubarticlePostProcessor(
            input,
            subArticlesToRender,
            services,
            project,
          ),
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
