/*
* html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kVariables,
} from "../config/constants.ts";
import { Format, FormatPandoc } from "../config/format.ts";
import { mergeConfigs } from "../core/config.ts";
import { resourcePath } from "../core/resources.ts";
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
        // return pandoc format additions
        const pandoc: FormatPandoc = {};
        // provide theme if requested

        const addToHeader = (
          header:
            | "include-in-header"
            | "include-after-body"
            | "include-before-body",
          file: string,
        ) => {
          pandoc[header] = pandoc[header] || [];
          pandoc[header]?.push(file);
        };

        if (format.metadata["theme"] !== null) {
          const theme = format.metadata["theme"] || "default";

          if (theme === "pandoc") {
            pandoc[kVariables] = {
              ...pandoc[kVariables],
              ["document-css"]: true,
            };
          } else {
            pandoc[kVariables] = {
              ...pandoc[kVariables],
              ["document-css"]: false,
            };

            const themePath = resourcePath(
              `formats/html/bootstrap/themes/${theme}/bootstrap.min.css`,
            );
            if (!existsSync(themePath)) {
              throw new Error(`Specified theme ${theme} does not exist`);
            }

            const themeCss = Deno.readTextFileSync(themePath);
            const themeFile = sessionTempFile();
            Deno.writeTextFileSync(
              themeFile,
              `<style type="text/css">\n${themeCss}\n</style>\n`,
            );
            addToHeader(kIncludeInHeader, themeFile);

            addToHeader(
              kIncludeInHeader,
              resourcePath("formats/html/bootstrap/in-header.html"),
            );
            addToHeader(
              kIncludeBeforeBody,
              resourcePath("formats/html/bootstrap/before-body.html"),
            );
            addToHeader(
              kIncludeAfterBody,
              resourcePath("formats/html/bootstrap/after-body.html"),
            );
          }
        } else {
          pandoc[kVariables] = {
            ...pandoc[kVariables],
            ["document-css"]: false,
          };
        }

        return pandoc;
      },
    },
  );
}
