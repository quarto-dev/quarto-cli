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
  if (!options) return {};

  return {
    [kIncludeInHeader]: [
      temp.createFileFromString(
        `<script id="quarto-axe-checker-options" type="text/plain">${
          encodeBase64(JSON.stringify(options))
        }</script>`,
      ),
    ],
    html: {
      "sass-bundles": [
        {
          key: "axe",
          dependency: "bootstrap",
          user: [{
            uses: "",
            defaults: "",
            functions: "",
            mixins: "",
            rules: `
body div.quarto-axe-report {
  position: fixed;
  bottom: 3rem;
  right: 3rem;
  padding: 1rem;
  border: 1px solid $body-color;
}

.quarto-axe-violation-help { padding-left: 0.5rem; }
.quarto-axe-violation-selector { padding-left: 1rem; }
.quarto-axe-violation-target {
  padding: 0.5rem;
  color: $link-color;
  text-decoration: underline;
  cursor: pointer;
}
  
.quarto-axe-hover-highlight {
  background-color: red;
  border: 1px solid $body-color;
}`,
          }],
        },
      ],
    },
  };
}
