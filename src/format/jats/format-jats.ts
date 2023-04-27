/*
* format-jats.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import {
  kDefaultImageExtension,
  kLinkCitations,
  kQuartoInternal,
  kVariant,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { createFormat } from "../formats-shared.ts";

import { warning } from "log/mod.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { join } from "path/mod.ts";
import { reformat } from "../../core/xml.ts";
import { RenderServices } from "../../command/render/types.ts";

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
      _input: string,
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

      const reformatXmlPostProcessor = async (output: string) => {
        await reformat(output);
      };

      return {
        metadata: {
          [kQuartoInternal]: {
            // These signal the template with flags controlling the tagset to be output
            [kJatsExtended]: tagset === "archiving" || tagset === "publishing",
            [kJatsDtd]: jatsDtd(tagset),
          },
        },
        templateContext,
        metadataOverride,
        postprocessors: [reformatXmlPostProcessor],
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
