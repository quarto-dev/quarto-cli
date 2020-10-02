import type { FormatDefinition, FormatOptions } from "../api/format.ts";

import { htmlDocument } from "./html_document.ts";
import { pdfDocument } from "./pdf_document.ts";

// TODO: currently we ignore invalid options (non-specified or wrong type)
// need a more robust mechanism here

export function createFormat(name: string, options: FormatOptions) {
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
