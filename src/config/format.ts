import { extname } from "path/mod.ts";

import type { Format } from "../api/format.ts";
import { computationEngineForFile } from "../computation/engine.ts";

import { Config, projectConfig, resolveConfig } from "./config.ts";
import { metadataFromFile } from "./metadata.ts";
import { mergeConfigs } from "./config.ts";
import { kSelfContained } from "./constants.ts";

export async function formatForInputFile(
  input: string,
  to?: string,
): Promise<Format> {
  // look for a 'project' _quarto.yml
  const projConfig: Config = await projectConfig(input);

  // get metadata from computational preprocessor (or from the raw .md)
  const engine = computationEngineForFile(input);
  const fileMetadata = engine
    ? await engine.metadata(input)
    : await metadataFromFile(input);

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

function defaultWriterFormat(writer: string) {
  // get defaults for writer
  let writerFormat: Format;
  switch (writer) {
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

    default:
      writerFormat = format(writer);
  }

  // pdf writer means 'latex' b/c we never ask pandoc for pdf
  if (writer === "pdf") {
    writer = "latex";
  }

  // set the writer
  writerFormat.pandoc = writerFormat.pandoc || {};
  writerFormat.pandoc.writer = writer;

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
        [kSelfContained]: true,
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
    },
    output: {
      ext: "html",
    },
    pandoc: {
      reader: "markdown",
    },
  };
}
