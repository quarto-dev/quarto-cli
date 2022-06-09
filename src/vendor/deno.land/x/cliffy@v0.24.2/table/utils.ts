/**
 * Get next words from the beginning of [content] until all words have a length lower or equal then [length].
 *
 * @param length    Max length of all words.
 * @param content   The text content.
 */
import { Cell, ICell } from "./cell.ts";
import { stripColor } from "./deps.ts";

export function consumeWords(length: number, content: string): string {
  let consumed = "";
  const words: string[] = content.split("\n")[0]?.split(/ /g);

  for (let i = 0; i < words.length; i++) {
    const word: string = words[i];

    // consume minimum one word
    if (consumed) {
      const nextLength = strLength(word);
      const consumedLength = strLength(consumed);
      if (consumedLength + nextLength >= length) {
        break;
      }
    }

    consumed += (i > 0 ? " " : "") + word;
  }

  return consumed;
}

/**
 * Get longest cell from given row index.
 */
export function longest(
  index: number,
  rows: ICell[][],
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
  str = stripColor(str);
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // Check for chinese characters: \u4e00 - \u9fa5
    if (charCode >= 19968 && charCode <= 40869) {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
};
