/*
 * format-html-axe.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { kIncludeInHeader } from "../../config/constants.ts";
import { Format, FormatExtras } from "../../config/types.ts";
import { TempContext } from "../../core/temp-types.ts";
import { encodeBase64 } from "../../deno_ral/encoding.ts";

export function axeFormatDependencies(
  _format: Format,
  temp: TempContext,
  options?: unknown,
): FormatExtras {
  if (!options) {
    return {};
  }

  return {
    [kIncludeInHeader]: [
      temp.createFileFromString(
        `<script id="quarto-axe-checker-options" type="text/plain">${
          encodeBase64(JSON.stringify(options))
        }</script>`,
      ),
    ],
  };
}
