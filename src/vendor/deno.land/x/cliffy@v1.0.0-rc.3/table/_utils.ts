/**
 * Get next words from the beginning of [content] until all words have a length lower or equal then [length].
 *
 * @param length    Max length of all words.
 * @param content   The text content.
 */
import { Cell, CellType } from "./cell.ts";
import { consumeWords } from "./consume_words.ts";
import { stripColor, unicodeWidth } from "./deps.ts";

/**
 * Get longest cell from given row index.
 */
export function longest(
  index: number,
  rows: Array<Array<CellType>>,
  maxWidth?: number,
): number {
  const cellLengths = rows.map((row) => {
    const cell = row[index];
    const cellValue = cell instanceof Cell && cell.getColSpan() > 1
      ? ""
      : cell?.toString() || "";

    return cellValue
      .split("\n")
      .map((line: string) => {
        const str = typeof maxWidth === "undefined"
          ? line
          : consumeWords(maxWidth, line);

        return strLength(str) || 0;
      });
  }).flat();

  return Math.max(...cellLengths);
}

export const strLength = (str: string): number => {
  return unicodeWidth(stripColor(str));
};
