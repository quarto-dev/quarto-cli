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
  [key: string]: unknown;
}
