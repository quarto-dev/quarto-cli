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
  kOutputFile,
  kQuartoInternal,
  kResources,
  kTemplate,
  kTo,
  kVariant,
} from "../../config/constants.ts";
import { Format, Metadata, PandocFlags } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { createFormat } from "../formats-shared.ts";

import { formatResourcePath } from "../../core/resources.ts";
import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";
import { kJatsSubarticle } from "./format-jats-types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { renderFiles } from "../../command/render/render-files.ts";
import { dirAndStem } from "../../core/path.ts";

import { dirname, join, relative } from "path/mod.ts";
import { copySync } from "fs/copy.ts";
import { warning } from "log/mod.ts";

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
      services: RenderServices,
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

      // XML Linting
      const reformatXmlPostProcessor = async (output: string) => {
        await reformat(output);
      };
      if (format.metadata[kLintXml] !== false) {
        postprocessors.push(reformatXmlPostProcessor);
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
      if (subArticleSupporting.length > 0) {
        postprocessors.push(
          moveSubarticleSupportingPostProcessor(subArticleSupporting),
        );
      }

      // Injects the root subarticle
      const renderSubarticlePostProcessor = () => {
        return async (output: string) => {
          for (const subArticle of subArticlesToRender) {
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
                    [kTemplate]: templatePath,
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
              console.log(placeholder);

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
      if (subArticlesToRender.length > 0) {
        postprocessors.push(renderSubarticlePostProcessor());
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

function xmlPlaceholder(token: string, input: string) {
  return `<!-- (F2ED4C6E)[${token}]:${input} -->`;
}

export interface JatsSubArticle {
  input: string;
  output: string;
  supporting: string[];
  resources: string[];
  render: false;
}

export interface JatsRenderSubArticle {
  input: string;
  token: string;
  render: true;
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

const templatePath = formatResourcePath(
  "jats",
  join("pandoc", "subarticle", "template.xml"),
);

export const resolveJatsSubarticleMetadata = (
  format: Format,
  subArticleId: string,
) => {
  // Use the subarticle template
  format.pandoc.template = templatePath;

  // Configure the JATS rendering
  format.metadata[kLintXml] = false;
  format.metadata[kJatsSubarticle] = true;
  format.metadata[kJatsSubarticleId] = subArticleId;
};
