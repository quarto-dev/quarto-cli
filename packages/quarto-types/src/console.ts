/**
 * Console and UI types for Quarto
 */

/**
 * Options for displaying a spinner in the console
 */
export interface SpinnerOptions {
  /** Message to display with the spinner (or function that returns message) */
  message: string | (() => string);
  /** Message to display when done, or false to hide, or true to keep original message */
  doneMessage?: string | boolean;
}

/**
 * Options for log messages (info, warning, error)
 */
export interface LogMessageOptions {
  /** Whether to add a trailing newline (default: true) */
  newline?: boolean;
  /** Apply bold formatting */
  bold?: boolean;
  /** Apply dim/gray formatting */
  dim?: boolean;
  /** Number of spaces to indent each line */
  indent?: number;
  /** Custom format function applied to each line */
  format?: (line: string) => string;
  /** Enable color formatting (default: true) */
  colorize?: boolean;
  /** Remove ANSI escape codes from output */
  stripAnsiCode?: boolean;
}
