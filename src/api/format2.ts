import { ld } from "lodash/mod.ts";

export interface FormatFigureOptions {
  width?: number;
  height?: number;
  format?: "png" | "pdf";
  dpi?: number;
}

export interface FormatShowOptions {
  code?: boolean;
  warnings?: boolean;
  errors?: boolean;
}

export interface FormatKeepOptions {
  md?: boolean;
  tex?: boolean;
  supporting?: boolean;
}

export interface FormatPandocOptions {
  ext?: string;
  args?: string[];
}

export interface FormatOptions2 {
  figure?: FormatFigureOptions;
  show?: FormatShowOptions;
  keep?: FormatKeepOptions;
  pandoc?: FormatPandocOptions;
}

export function formatOptions(...options: FormatOptions2[]) {
  return mergeFormatOptions(defaultFormatOptions(), ...options);
}

export function mergeFormatOptions(
  ...options: FormatOptions2[]
): FormatOptions2 {
  return ld.merge(options[0], ...options.slice(1));
}

export function defaultFormatOptions(): FormatOptions2 {
  return {
    figure: {
      width: 7,
      height: 5,
      format: "png",
      dpi: 96,
    },
    show: {
      code: true,
      warnings: true,
      errors: false,
    },
    keep: {
      md: false,
      tex: false,
      supporting: true,
    },
    pandoc: {
      ext: "html",
      args: [],
    },
  };
}
