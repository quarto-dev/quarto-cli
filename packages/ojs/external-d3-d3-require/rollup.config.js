import {terser} from "rollup-plugin-terser";
import * as meta from "./package.json";

const config = {
  input: "src/index.mjs",
  external: Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)),
  output: {
    file: `dist/${meta.name}.js`,
    name: "d3",
    format: "umd",
    indent: false,
    extend: true,
    banner: `// ${meta.name} v${meta.version} Fork changes are Copyright ${(new Date).getFullYear()} ${meta.author.name}\n// Original package Copyright ${(new Date).getFullYear()} ObservableHQ.`,
    globals: Object.assign({}, ...Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)).map(key => ({[key]: "d3"})))
  },
  plugins: []
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: `dist/${meta.name}.min.js`
    },
    plugins: [
      ...config.plugins,
      terser({
        output: {
          preamble: config.output.banner
        },
        mangle: {
          reserved: ["RequireError"]
        }
      })
    ]
  }
];
