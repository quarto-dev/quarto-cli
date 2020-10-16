export interface FormatFigure {
  width?: number;
  height?: number;
  format?: "png" | "pdf";
  dpi?: number;
}

export interface FormatShow {
  code?: boolean;
  warning?: boolean;
  error?: boolean;
}

export interface FormatKeep {
  md?: boolean;
  tex?: boolean;
}

export interface FormatOutput {
  ext?: string;
}

export interface FormatPandoc {
  reader?: string;
  writer?: string;
  [key: string]: unknown;
}

export interface Format {
  figure?: FormatFigure;
  show?: FormatShow;
  keep?: FormatKeep;
  output?: FormatOutput;
  pandoc?: FormatPandoc;
  [key: string]: unknown;
}
