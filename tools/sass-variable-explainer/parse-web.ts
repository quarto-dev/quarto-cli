import { parse } from 'https://cdn.skypack.dev/scss-parser/';
// seems impossible to get prettier to work in the browser
// import prettier from 'https://cdn.skypack.dev/prettier';
// import * as prettier from "https://esm.sh/prettier@3.3.3"; // skypack crashes with prettier
import { makeParserModule } from "./parse.ts";

export const getSassAst = makeParserModule(parse).getSassAst;