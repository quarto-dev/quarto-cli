import { ld } from "lodash/mod.ts";

export interface FormatFigureOptions {
  width?: number;
  height?: number;
  format?: "png" | "pdf";
  dpi?: number;
}

export interface FormatShowOptions {
  code?: boolean;
  warning?: boolean;
  error?: boolean;
}

export interface FormatKeepOptions {
  md?: boolean;
  tex?: boolean;
  supporting?: boolean;
}

export interface FormatPandocOptions {
  reader?: string;
  writer?: string;
  "output-ext"?: string;
  [key: string]: unknown;
}

export interface FormatOptions {
  figure?: FormatFigureOptions;
  show?: FormatShowOptions;
  keep?: FormatKeepOptions;
  pandoc?: FormatPandocOptions;
}

export function formatOptions(...options: FormatOptions[]) {
  return mergeFormatOptions(defaultFormatOptions(), ...options);
}

export function mergeFormatOptions(
  ...options: FormatOptions[]
): FormatOptions {
  return ld.merge(options[0], ...options.slice(1));
}

export function defaultFormatOptions(): FormatOptions {
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
      writer: "html",
      ext: "html",
      args: [],
    },
  };
}
