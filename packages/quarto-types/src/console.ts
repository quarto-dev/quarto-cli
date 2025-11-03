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
