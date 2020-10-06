import type { FormatOptions } from "../api/format.ts";
import {
  defaultFormatOptions,
  formatOptions,
} from "../api/format.ts";
import type { QuartoConfig } from "../core/config.ts";

// TODO: currently we ignore invalid options (non-specified or wrong type)
// need a more robust mechanism here

const formatDefaults: { [key: string]: FormatOptions } = {
  pdf: pdfOptions(),
  beamer: beamerOptions(),
  html: htmlOptions("html"),
  html4: htmlOptions("html4"),
  html5: htmlOptions("html5"),
};

export function formatOptionsFromConfig(to: string, config: QuartoConfig) {
  let defaults = formatDefaults[to] || defaultFormatOptions();

  // TODO: do the merge

  return defaults;
}

function pdfOptions() {
  return formatOptions({
    figure: {
      width: 6.5,
      height: 4.5,
      format: "pdf",
    },
    pandoc: {
      writer: "latex",
      ext: "pdf",
      args: ["--self-contained"],
    },
  });
}

function beamerOptions() {
  return formatOptions(
    pdfOptions(),
    {
      figure: {
        width: 10,
        height: 7,
      },
      pandoc: {
        writer: "beamer",
      },
    },
  );
}

function htmlOptions(writer: string) {
  return formatOptions({
    pandoc: {
      writer,
      args: ["--standalone"],
    },
  });
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
