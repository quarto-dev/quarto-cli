/**
 * Pandoc types for Quarto
 */

/**
 * Valid Pandoc include locations
 */
export type PandocIncludeLocation =
  | "include-in-header"
  | "include-before-body"
  | "include-after-body";

/**
 * Pandoc includes for headers, body, etc.
 * Mapped type that allows any of the valid include locations
 */
export type PandocIncludes = {
  [K in PandocIncludeLocation]?: string[];
};
