/*
 * format-html-axe.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { kIncludeInHeader } from "../../config/constants.ts";
import { isRevealjsOutput } from "../../config/format.ts";
import { Format, FormatExtras, kDependencies } from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { TempContext } from "../../core/temp-types.ts";
import { encodeBase64 } from "../../deno_ral/encoding.ts";
import { join } from "../../deno_ral/path.ts";

export function axeFormatDependencies(
  format: Format,
  temp: TempContext,
  options?: unknown,
): FormatExtras {
  if (!options) return {};

  // Use reveal-theme for revealjs, bootstrap for other HTML formats.
  // Note: For revealjs, sass-bundles compile separately from the theme
  // (which compiles in format-reveal-theme.ts), so the !default values
  // below are used instead of actual theme colors. This is a known
  // limitation - see GitHub issue for architectural context.
  const sassDependency = isRevealjsOutput(format.pandoc)
    ? "reveal-theme"
    : "bootstrap";

  return {
    [kIncludeInHeader]: [
      temp.createFileFromString(
        `<script id="quarto-axe-checker-options" type="text/plain">${
          encodeBase64(JSON.stringify(options))
        }</script>`,
      ),
    ],
    html: {
      [kDependencies]: [{
        name: "quarto-axe",
        scripts: [{
          name: "axe-check.js",
          path: formatResourcePath("html", join("axe", "axe-check.js")),
          attribs: { type: "module" },
        }],
      }],
      "sass-bundles": [
        {
          key: "axe",
          dependency: sassDependency,
          user: [{
            uses: "",
            defaults: `
$body-color: #222 !default;
$body-bg: #fff !default;
$link-color: #2a76dd !default;
`,
            functions: "",
            mixins: "",
            rules: `
body div.quarto-axe-report {
  position: fixed;
  bottom: 3rem;
  right: 3rem;
  padding: 1rem;
  border: 1px solid var(--r-main-color, $body-color);
  z-index: 9999;
  background-color: var(--r-background-color, $body-bg);
  color: var(--r-main-color, $body-color);
  max-height: 50vh;
  overflow-y: auto;
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
