/**
 * Core text manipulation types for Quarto
 */

/**
 * Represents a range within a string
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * A string with source mapping information
 */
export interface MappedString {
  /**
   * The text content
   */
  readonly value: string;

  /**
   * Optional filename where the content originated
   */
  readonly fileName?: string;

  /**
   * Maps positions in this string back to positions in the original source
   * @param index Position in the current string
   * @param closest Whether to find the closest mapping if exact is not available
   */
  readonly map: (index: number, closest?: boolean) => StringMapResult;
}

/**
 * Result of mapping a position in a mapped string
 */
export type StringMapResult = {
  /**
   * Position in the original source
   */
  index: number;

  /**
   * Reference to the original mapped string
   */
  originalString: MappedString;
} | undefined;

/**
 * String that may be mapped or unmapped
 */
export type EitherString = string | MappedString;