import { extname } from "path/mod.ts";

import type { FormatOptions } from "../../api/format.ts";
import { computationEngineForFile } from "../../computation/engine.ts";

import {
  mergeConfigs,
  mergeFormatOptions,
  projectConfig,
  QuartoConfig,
  resolveConfig,
} from "../../core/config.ts";
import { metadataFromFile } from "../../core/metadata.ts";
import { fixupPandocArgs } from "./flags.ts";

export async function optionsForInputFile(
  input: string,
  to?: string,
): Promise<FormatOptions> {
  // look for a 'project' _quarto.yml
  const projConfig: QuartoConfig = await projectConfig(input);

  // get metadata from computational preprocessor (or from the raw .md)
  const ext = extname(input);
  const engine = computationEngineForFile(ext);
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
  return optionsFromConfig(writer, config);
}

function optionsFromConfig(
  writer: string,
  config: QuartoConfig,
): FormatOptions {
  // merge default format options w/ user config
  let options = kDefaultFormatOptions[writer] || formatOptions(writer);

  // set the writer
  options.pandoc!.writer = writer;

  // see if there is config for this writer
  if (config[writer] instanceof Object) {
    options = mergeFormatOptions(options, config[writer]);
  }

  // any unknown top level option gets folded into pandoc
  options.pandoc = options.pandoc || {};
  Object.keys(options).forEach((key) => {
    if (
      !["figure", "show", "keep", "output", "pandoc", "extensions", "engine"]
        .includes(
          key,
        )
    ) {
      options.pandoc![key] = options[key];
      delete options[key];
    }
  });

  return options!;
}

const kDefaultFormatOptions: { [key: string]: FormatOptions } = {
  pdf: pdfOptions(),
  beamer: beamerOptions(),
  html: htmlOptions(),
  html4: htmlOptions(),
  html5: htmlOptions(),
  revealjs: presentationOptions(8, 6),
};

function pdfOptions() {
  return formatOptions(
    "pdf",
    {
      figure: {
        width: 6.5,
        height: 4.5,
        format: "pdf",
      },
      pandoc: {
        "self-contained": true,
      },
    },
  );
}

function beamerOptions() {
  return formatOptions(
    "pdf",
    pdfOptions(),
    {
      figure: {
        width: 10,
        height: 7,
      },
    },
  );
}

function presentationOptions(figwidth = 7, figheight = 5) {
  return mergeFormatOptions(
    htmlOptions(figwidth, figheight),
    {
      pandoc: {
        "self-contained": true,
      },
    },
  );
}

function htmlOptions(figwidth = 7, figheight = 5) {
  return formatOptions("html", {
    figure: {
      width: figwidth,
      height: figheight,
    },
    pandoc: {
      standalone: true,
    },
  });
}

function formatOptions(ext: string, ...options: FormatOptions[]) {
  return mergeFormatOptions(
    defaultFormatOptions(),
    ...options,
    {
      output: {
        ext,
      },
    },
  );
}

function defaultFormatOptions(): FormatOptions {
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
