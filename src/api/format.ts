export interface FormatOption<T = unknown> {
  name: string;
  description: string;
  default: T | null;
}

export interface FormatDefinition {
  // format name
  name: string;

  // format options
  options: FormatOption[];

  // create an instance of this format w/ the provided options
  create: (options: { [key: string]: unknown }) => Format;
}

export interface Format {
  // preprocessor options
  preprocessor?: {
    figure_width?: number; // default: 7in
    figure_height?: number; // default: 5in
    figure_format?: "png" | "pdf"; // default: "png"
    figure_dpi?: number; // default: 72
    hide_code?: boolean; // default: false
    show_warnings?: boolean; // default: false
    show_messages?: boolean; // default: false
  };

  // pandoc options
  pandoc?: {
    to?: string; // any pandoc format
    from?: string; // defaults to 'markdown'
    args?: string[]; // pandoc command line arguments
  };

  // clean supporting files?
  clean_supporting?: boolean;

  // keep intermediate markdown or tex?
  keep_md?: boolean;
  keep_tex?: boolean;
}
