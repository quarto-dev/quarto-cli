/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { kStandalone } from "../config/constants.ts";
import { mergeConfigs } from "../core/config.ts";
import { Format } from "./config.ts";

import {
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepTex,
  kOutputExt,
  kShowCode,
  kShowError,
  kShowWarning,
} from "./constants.ts";

export function defaultWriterFormat(to: string) {
  // get defaults for writer
  let writerFormat: Format;
  switch (to) {
    case "html":
    case "html4":
    case "html5":
      writerFormat = htmlFormat();
      break;

    case "pdf":
      writerFormat = pdfFormat();
      break;

    case "beamer":
      writerFormat = beamerFormat();
      break;

    case "latex":
      writerFormat = latexFormat();
      break;

    case "s5":
    case "dzslides":
    case "slidy":
    case "slideous":
      writerFormat = htmlPresentationFormat(9.5, 6.5);
      break;
    case "revealjs":
      writerFormat = htmlPresentationFormat(9, 5);
      break;

    case "markdown":
    case "markdown_phpextra":
    case "markdown_github":
    case "markdown_mmd":
    case "markdown_strict":
    case "commonmark":
    case "gfm":
    case "commonmark_x":
      writerFormat = markdownFormat();
      break;

    default:
      writerFormat = format(to);
  }

  // set the writer
  writerFormat.defaults = writerFormat.defaults || {};
  writerFormat.defaults.to = to;

  // return the format
  return writerFormat;
}

function pdfFormat() {
  return format(
    "pdf",
    {
      [kFigWidth]: 6.5,
      [kFigHeight]: 4.5,
      [kFigFormat]: "pdf",
      defaults: {
        [kStandalone]: true,
        variables: {
          graphics: true,
        },
      },
    },
  );
}

function beamerFormat() {
  return format(
    "pdf",
    pdfFormat(),
    {
      [kFigWidth]: 10,
      [kFigHeight]: 7,
    },
  );
}

function latexFormat() {
  return format(
    "tex",
    pdfFormat(),
  );
}

function htmlPresentationFormat(figwidth: number, figheight: number) {
  return mergeConfigs(
    htmlFormat(figwidth, figheight),
    {
      [kShowCode]: false,
      [kShowWarning]: false,
    },
  );
}

function htmlFormat(figwidth = 7, figheight = 5) {
  return format("html", {
    [kFigWidth]: figwidth,
    [kFigHeight]: figheight,
    defaults: {
      [kStandalone]: true,
    },
  });
}

function markdownFormat() {
  return format("md", {
    [kFigWidth]: 7,
    [kFigHeight]: 5,
    defaults: {
      [kStandalone]: true,
      // NOTE: this will become the default in the next
      // version of pandoc, remove this flag after that
      ["atx-headers"]: true,
    },
  });
}

function format(ext: string, ...formats: Format[]) {
  return mergeConfigs(
    defaultFormat(),
    ...formats,
    {
      [kOutputExt]: ext,
    },
  );
}

function defaultFormat(): Format {
  return {
    [kFigWidth]: 7,
    [kFigHeight]: 5,
    [kFigFormat]: "png",
    [kFigDpi]: 96,
    [kShowCode]: true,
    [kShowWarning]: true,
    [kShowError]: false,
    [kKeepMd]: false,
    [kKeepTex]: false,
    [kOutputExt]: "html",
    defaults: {
      from: "markdown",
    },
  };
}
