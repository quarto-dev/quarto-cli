/**
 * Parser interface
 */
export type Parser = (html: string, contextLocalName?: string) => string;
export let parse: Parser = (_html) => {
  console.error("Error: deno-dom: No parser registered");
  Deno.exit(1);
};

export let parseFrag: Parser = (_html, _contextLocalName) => {
  console.error("Error: deno-dom: No parser registered");
  Deno.exit(1);
};

const originalParse = parse;
export function register(func: Parser, fragFunc: Parser) {
  if (parse !== originalParse) {
    return;
  }

  parse = func;
  parseFrag = fragFunc;
}
