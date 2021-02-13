/*
* format-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import {
  kFilters,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kVariables,
} from "../config/constants.ts";
import { Format, FormatExtras, FormatPandoc } from "../config/format.ts";
import { mergeConfigs } from "../core/config.ts";
import { formatResourcePath, resourcePath } from "../core/resources.ts";
import { sessionTempFile } from "../core/temp.ts";
import { baseHtmlFormat } from "./formats.ts";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    baseHtmlFormat(figwidth, figheight),
    {
      preprocess: (format: Format) => {
        // provide theme if requested
        const kTheme = "theme";
        if (format.metadata[kTheme] !== null) {
          // 'default' if theme is undefined
          const theme = String(format.metadata[kTheme] || "default");

          // 'pandoc' theme means include default pandoc document css
          if (theme === "pandoc") {
            return {
              [kVariables]: {
                ["document-css"]: true,
              },
            };

            // other themes are bootswatch themes or bootstrap css files
          } else {
            return bootstrapPandocConfig(theme);
          }

          // theme: null means no default document css at all
        } else {
          return {
            [kVariables]: {
              ["document-css"]: false,
            },
          };
        }
      },
    },
  );
}

function bootstrapPandocConfig(theme: string) {
  const extras: FormatExtras = {
    [kVariables]: {
      ["document-css"]: false,
      ["include-before"]: `<div class="container">`,
      ["include-after"]: `</div>`,
    },
    [kFilters]: {
      pre: [
        formatResourcePath("html", "html.lua"),
      ],
    },
  };

  const addToHeader = (
    header:
      | "include-in-header"
      | "include-after-body"
      | "include-before-body",
    file: string,
  ) => {
    extras[header] = extras[header] || [];
    extras[header]?.push(file);
  };

  // see if this is a named bootswatch theme
  let themePath = formatResourcePath(
    "html",
    `bootstrap/themes/${theme}/bootstrap.min.css`,
  );
  if (!existsSync(themePath)) {
    // see if this is a css file
    if (existsSync(theme)) {
      themePath = theme;
    } else {
      throw new Error(`Specified theme ${theme} does not exist`);
    }
  }

  const themeCss = Deno.readTextFileSync(themePath);
  const templateSrc = Deno.readTextFileSync(
    formatResourcePath("html", "in-header.html"),
  );
  const template = ld.template(templateSrc, {}, undefined);

  const themeFile = sessionTempFile();
  Deno.writeTextFileSync(
    themeFile,
    template({ themeCss }),
  );
  addToHeader(kIncludeInHeader, themeFile);

  return extras;
}
