/*
* format-jats.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import {
  kDefaultImageExtension,
  kLinkCitations,
} from "../../config/constants.ts";
import { Format, Metadata, PandocFlags } from "../../config/types.ts";
import { TempContext } from "../../core/temp-types.ts";
import { ExtensionContext } from "../../extension/extension-shared.ts";
import { ProjectContext } from "../../project/types.ts";
import { createFormat } from "../formats-shared.ts";

import { warning } from "log/mod.ts";

export function jatsFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    formatExtras: (
      _input: string,
      _markdown: string,
      _flags: PandocFlags,
      format: Format,
      _libDir: string,
      _temp: TempContext,
      _offset?: string,
      _extensionContext?: ExtensionContext,
      _project?: ProjectContext,
    ) => {
      // If this has been explicitly disabled, warn the user that the setting is being ignored
      if (format.metadata[kLinkCitations] === false) {
        warning(
          "JATS formats require that `link-citations` is enabled to emit well formed JATS. Explicitly set value is being ignored.",
        );
      }
      return {
        metadataOverride: { [kLinkCitations]: true } as Metadata,
      };
    },
  });
}
