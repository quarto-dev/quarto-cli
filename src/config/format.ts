/*
* format.ts
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

import type { Format } from "../api/format.ts";
import { computationEngineForFile } from "../computation/engine.ts";

import { Config, projectConfig, resolveConfig } from "./config.ts";
import { metadataFromFile } from "./metadata.ts";
import { mergeConfigs } from "./config.ts";
import { readYAML } from "../core/yaml.ts";

export async function formatForInputFile(
  input: string,
  formatOptions?: string,
  to?: string,
): Promise<Format> {
  // look for a 'project' _quarto.yml
  const projConfig: Config = await projectConfig(input);

  // get metadata from computational preprocessor (or from the raw .md)
  const engine = computationEngineForFile(input);
  let fileMetadata = engine
    ? await engine.metadata(input)
    : metadataFromFile(input);

  // merge in any options provided via file
  if (formatOptions) {
    const format = readYAML(formatOptions) as Config;
    fileMetadata = mergeConfigs(fileMetadata, { quarto: format });
  }

  // get the file config
  const fileConfig = resolveConfig(fileMetadata.quarto || {});

  // determine which writer to use
  let writer = to;
  if (!writer) {
    writer = "html";
    const formats = Object.keys(fileConfig).concat(
      Object.keys(projectConfig),
    );
    if (formats.length > 0) {
      writer = formats[0];
    }
  }

  // derive quarto config from merge of project config into file config
  const config = mergeConfigs(projConfig, fileConfig);

  // get the format
  return formatFromConfig(writer, config);
}

function formatFromConfig(
  writer: string,
  config: Config,
): Format {
  // get default options for this writer
  let format = defaultWriterFormat(writer);

  // see if there is config for this writer
  if (config[writer] instanceof Object) {
    format = mergeConfigs(format, config[writer]);
  }

  // any unknown top level option get folded into pandoc
  format.pandoc = format.pandoc || {};
  Object.keys(format).forEach((key) => {
    if (
      !["figure", "show", "keep", "output", "pandoc", "extensions", "engine"]
        .includes(
          key,
        )
    ) {
      format.pandoc = format.pandoc || {};
      format.pandoc[key] = format[key];
      delete format[key];
    }
  });

  return format;
}

function defaultWriterFormat(to: string) {
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
  writerFormat.pandoc = writerFormat.pandoc || {};
  writerFormat.pandoc.to = to;

  // return the format
  return writerFormat;
}

function pdfFormat() {
  return format(
    "pdf",
    {
      figure: {
        width: 6.5,
        height: 4.5,
        format: "pdf",
      },
      pandoc: {
        standalone: true,
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
      figure: {
        width: 10,
        height: 7,
      },
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
      show: {
        code: false,
        warning: false,
      },
    },
  );
}

function htmlFormat(figwidth = 7, figheight = 5) {
  return format("html", {
    figure: {
      width: figwidth,
      height: figheight,
    },
    pandoc: {
      standalone: true,
    },
  });
}

function markdownFormat() {
  return format("md", {
    figure: {
      width: 7,
      height: 5,
    },
    pandoc: {
      standalone: true,
      // NOTE: this will become the default in the next
      // version of pandoc, remove this flag after that
      ["atx-headers"]: true,
    },
  });
}

function format(ext: string, ...formats: Format[]) {
  return mergeConfigs(
    defaultForamt(),
    ...formats,
    {
      output: {
        ext,
      },
    },
  );
}

function defaultForamt(): Format {
  return {
    figure: {
      width: 7,
      height: 5,
      format: "png",
      dpi: 96,
    },
    show: {
      code: true,
      warning: true,
      error: false,
    },
    keep: {
      md: false,
      tex: false,
    },
    output: {
      ext: "html",
    },
    pandoc: {
      from: "markdown",
    },
  };
}
