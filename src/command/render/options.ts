import { ld } from "lodash/mod.ts";

import type { FormatOptions, FormatPandocOptions } from "../../api/format.ts";

import type { QuartoConfig } from "../../core/config.ts";

// TODO: the first format listed in the file needs to take precedence over formats
// listed in the project file

export function optionsFromConfig(config: QuartoConfig, writer?: string) {
  // if there is writer, then see if the config has a default (otherwise use html)
  if (!writer) {
    writer = "html";
    const formats = Object.keys(config);
    if (formats.length > 0) {
      writer = formats[0];
    }
  }

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
  html: htmlOptions("html"),
  html4: htmlOptions("html4"),
  html5: htmlOptions("html5"),
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

function htmlOptions(writer: string) {
  return formatOptions("html", {
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

function mergeFormatOptions(
  ...options: FormatOptions[]
): FormatOptions {
  return ld.merge(options[0], ...options.slice(1));
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

/*
export function formatFromConfig(config: QuartoConfig, name?: string) {
  // if there is an explicit name then look for it in the config
  let options: FormatOptions = {};
  if (name) {
    if (config.output) {
      options = config.output[name] || {};
    }
  } else {
    name = htmlDocument.name;
    if (config.output) {
      const formats = Object.keys(config.output);
      if (formats.length > 0) {
        name = formats[0];
        options = config.output[name] || {};
      }
    }
  }

  // determine target format
  const format = allFormats.find((format) => format.name === name) ||
    htmlDocument;

  // resolve all format options
  const resolvedOptions: FormatOptions = {};
  format.options.forEach((option) => {
    const value = options[option.name] || option.default;
    if (typeof value === typeof option.default) {
      resolvedOptions[option.name] = value;
    }
  });

  // create the format
  const fmt = format.create(resolvedOptions);

  // provide defaults
  fmt.preprocessor = fmt.preprocessor || {};
  fmt.preprocessor = {
    fig_width: 7,
    fig_height: 5,
    fig_format: "png",
    fig_dpi: 96,
    hide_code: false,
    show_warnings: false,
    show_messages: false,
    ...fmt.preprocessor,
  };
  fmt.pandoc = fmt.pandoc || {};
  fmt.pandoc = {
    to: "html5",
    from: "markdown",
    ext: "html",
    args: [],
    ...fmt.pandoc,
  };

  fmt.keep_md = fmt.keep_md || false;
  fmt.keep_tex = fmt.keep_tex || false;
  fmt.clean_supporting = fmt.clean_supporting || false;

  return fmt;
}

const allFormats: FormatDefinition[] = [
  htmlDocument,
  pdfDocument,
];
*/
