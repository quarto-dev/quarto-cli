//Imports
import { Stringifier } from "./utils/stringifier.ts"
import type { StringifierOptions, udocument } from "./utils/types.ts"

/** XML stringifier */
export function stringify(content: udocument, options?: StringifierOptions): string {
  return new Stringifier(content, options).stringify()
}
