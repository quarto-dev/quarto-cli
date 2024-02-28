import { strLength } from "./_utils.ts";

/**
 * Consumes the maximum amount of words from a string which is not longer than
 * given length. This function returns at least one word.
 *
 * ```ts
 * import { consumeWords } from "./mod.ts";
 *
 * const str = consumeWords(9, "This is an example."); // returns: "This is"
 * ```
 *
 * @param length  The maximum length of the returned string.
 * @param content The content from which the string should be consumed.
 */
export function consumeWords(length: number, content: string): string {
  let consumed = "";
  const words: Array<string> = content.split("\n")[0]?.split(/ /g);

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
