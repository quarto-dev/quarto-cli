import type { FormatDefinition, FormatOptions } from "../api/format.ts";
import type { QuartoConfig } from "../core/config.ts";

import { htmlDocument } from "./html_document.ts";
import { pdfDocument } from "./pdf_document.ts";

// TODO: currently we ignore invalid options (non-specified or wrong type)
// need a more robust mechanism here

export function formatFromConfig(config: QuartoConfig, name?: string) {
  // if there is an explicit name then look for it in the config
  let options: FormatOptions = {};
  if (name) {
    if (config.output) {
      options = config.output[name] || {};
    }
  } else {
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
  return format.create(resolvedOptions);
}

const allFormats: FormatDefinition[] = [
  htmlDocument,
  pdfDocument,
];
