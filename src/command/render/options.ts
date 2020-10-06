import type { FormatOptions } from "../../api/format.ts";

import {
  mergeFormatOptions,
  QuartoConfig,
} from "../../core/config.ts";

export function optionsFromConfig(writer: string, config: QuartoConfig) {
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
      !["figure", "show", "keep", "pandoc", "extensions", "engine"].includes(
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
  revealjs: htmlOptions(8, 6),
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
      keep: {
        supporting: false,
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
      pandoc: {
        "output-ext": ext,
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
      tex: false,
      supporting: true,
    },
    pandoc: {
      reader: "markdown",
    },
  };
}
