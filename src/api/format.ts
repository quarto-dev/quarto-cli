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
}

export interface FormatOutputOptions {
  ext?: string;
}

export interface FormatPandocOptions {
  reader?: string;
  writer?: string;
  [key: string]: unknown;
}

export interface FormatOptions {
  figure?: FormatFigureOptions;
  show?: FormatShowOptions;
  keep?: FormatKeepOptions;
  output?: FormatOutputOptions;
  pandoc?: FormatPandocOptions;
  [key: string]: unknown;
}
