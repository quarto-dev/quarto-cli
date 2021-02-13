/*
* format-html.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { ld } from "lodash/mod.ts";

import { kFilters, kIncludeInHeader, kVariables } from "../config/constants.ts";
import { Format, FormatExtras } from "../config/format.ts";
import { mergeConfigs } from "../core/config.ts";
import { formatResourcePath } from "../core/resources.ts";
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
            return bootstrapPandocConfig({
              theme,
              maxWidth: maxWidthCss(format.metadata["max-width"]),
              margintop: asCssSize(format.metadata["margin-top"]),
              marginbottom: asCssSize(format.metadata["margin-bottom"]),
              marginleft: asCssSize(format.metadata["margin-left"]),
              marginright: asCssSize(format.metadata["margin-right"]),
              mainfont: asFontFamily(format.metadata["mainfont"]),
              fontsize: asCssSize(format.metadata["fontsize"]),
              fontcolor: asCssAttrib("color", format.metadata["fontcolor"]),
              linkcolor: asCssAttrib("color", format.metadata["linkcolor"]),
              monofont: asFontFamily(format.metadata["monofont"]),
              monobackgroundcolor: asCssAttrib(
                "background-color",
                format.metadata["monobackgroundcolor"],
              ),
              linestretch: asCssAttrib(
                "line-height",
                format.metadata["linestretch"],
              ),
              backgroundcolor: asCssAttrib(
                "background-color",
                format.metadata["backgroundcolor"],
              ),
            });
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

interface HtmlOptions {
  theme: string;
  maxWidth: string;
  margintop?: string;
  marginbottom?: string;
  marginleft?: string;
  marginright?: string;
  mainfont?: string;
  fontsize?: string;
  fontcolor?: string;
  linkcolor?: string;
  monofont?: string;
  monobackgroundcolor?: string;
  linestretch?: string;
  backgroundcolor?: string;
}

function bootstrapPandocConfig(options: HtmlOptions) {
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
    `bootstrap/themes/${options.theme}/bootstrap.min.css`,
  );
  if (!existsSync(themePath)) {
    // see if this is a css file
    if (existsSync(options.theme)) {
      themePath = options.theme;
    } else {
      throw new Error(`Specified theme ${options.theme} does not exist`);
    }
  }

  const themeCss = Deno.readTextFileSync(themePath);
  const templateSrc = Deno.readTextFileSync(
    formatResourcePath("html", "in-header.html"),
  );
  const template = ld.template(templateSrc, {}, undefined);

  // if we have a monobackground color then add padding, otherise
  // provide a default code block border treatment
  const monoBackground = options.monobackgroundcolor
    ? options.monobackgroundcolor + ";\npadding: 0.2em;"
    : "";
  const codeblockBorder = monoBackground
    ? ""
    : "padding-left: 0.5rem;\nborder-left: 3px solid;";

  const themeFile = sessionTempFile();
  Deno.writeTextFileSync(
    themeFile,
    template({
      themeCss,
      maxWidth: options.maxWidth,
      margintop: options.margintop || "1.5rem",
      marginbottom: options.marginbottom || "1.5rem",
      marginleft: options.marginleft || "0",
      marginright: options.marginright || "0",
      mainfont: options.mainfont || "",
      fontsize: options.fontsize || "16px",
      fontcolor: options.fontcolor || "",
      linkcolor: options.linkcolor || "",
      monofont: options.monofont || "",
      linestretch: options.linestretch || "",
      backgroundcolor: options.backgroundcolor || "",
      monoBackground,
      codeblockBorder,
    }),
  );
  addToHeader(kIncludeInHeader, themeFile);

  return extras;
}

function maxWidthCss(value: unknown) {
  const maxWidth = value
    ? typeof (value) === "number" ? value : parseInt(String(value))
    : 900;
  const breaks = [
    576,
    768,
    992,
    1200,
  ];
  const css: string[] = [];
  for (const bk of breaks) {
    if (maxWidth < bk || bk === breaks[breaks.length - 1]) {
      css.push(`@media (min-width: ${bk}px) {
  .container {
    max-width: ${maxWidth}px;
  }  
}`);
    }
  }
  return css.join("\n");
}

function asFontFamily(value: unknown) {
  if (!value) {
    return "";
  } else {
    const fontFamily = String(value)
      .split(",")
      .map((font) => {
        font = font.trim();
        if (font.includes(" ")) {
          font = `"${font}"`;
        }
        return font;
      })
      .filter((font) => font.length > 0)
      .join(", ");
    return `font-family: ${fontFamily};`;
  }
}

function asCssAttrib(attrib: string, value: unknown): string | undefined {
  if (!value) {
    return undefined;
  } else {
    return `${attrib}: ${String(value)};`;
  }
}

function asCssSize(value: unknown): string | undefined {
  if (typeof (value) === "number") {
    if (value === 0) {
      return "0";
    } else {
      return value + "px";
    }
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    if (str !== "0" && !str.match(/\w$/)) {
      return str + "px";
    } else {
      return str;
    }
  }
}
