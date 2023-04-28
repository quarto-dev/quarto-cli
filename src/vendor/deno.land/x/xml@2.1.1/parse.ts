//Imports
import { Parser } from "./utils/parser.ts"
import { Stream } from "./utils/stream.ts"
import { Streamable } from "./utils/streamable.ts"
import type { document, Flux, ParserOptions } from "./utils/types.ts"

/** XML parser */
export function parse(content: string | Flux, options?: ParserOptions): document {
  if (typeof content === "string") {
    content = new Streamable(content)
  }
  return new Parser(new Stream(content), options).parse() as document
}
