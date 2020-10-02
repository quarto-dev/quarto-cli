export interface FormatOptionDefinition<T = unknown> {
  name: string;
  description: string;
  default: T | null;
}

export interface FormatDefinition {
  // format name
  name: string;

  // format options
  options: FormatOptionDefinition[];

  // tex packages required by this format
  tex_packages?: string[];

  // create an instance of this format w/ the provided options
  create: (options: FormatOptions) => Format;
}

export type FormatOptions = { [key: string]: unknown };

export interface Format {
  // preprocessor options
  preprocessor?: {
    fig_width?: number; // default: 7in
    fig_height?: number; // default: 5in
    fig_format?: "png" | "pdf"; // default: "png"
    fig_dpi?: number; // default: 72
    hide_code?: boolean; // default: false
    show_warnings?: boolean; // default: false
    show_messages?: boolean; // default: false
  };

  // pandoc options
  pandoc?: {
    to?: string; // any pandoc format
    ext?: string; // target output extension
    from?: string; // defaults to 'markdown'
    args?: string[]; // pandoc command line arguments
  };

  // keep intermediate markdown or tex?
  keep_md?: boolean;
  keep_tex?: boolean;

  // clean supporting files?
  clean_supporting?: boolean;
}
