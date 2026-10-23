import {terser} from "rollup-plugin-terser";
import * as meta from "./package.json";

const copyright = `// @observablehq/parser v${meta.version} Copyright ${(new Date).getFullYear()} Observable, Inc.`;
const forkCopyright = `// @quarto/external-observablehq-parser v${meta.version} fork changes are Copyright ${(new Date).getFullYear()} RStudio, PBC.\n${copyright}`;

import theirBase from "./rollup.config.js";
const base = theirBase[0];

base.plugins = [
  terser({
    output: {    
      beautify: true,
      preamble: forkCopyright,
      indent_level: 2,
    },
    mangle: false,
    compress: false,
  })
];
base.output.format = "esm";
base.output.name = "quarto-dev/external-observablehq-parser"
base.output.file =  "dist/external-observablehq-parser.js"

console.log(base);

export default [ base ];