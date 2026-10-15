import nodeResolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import meta from "./package.json" with { type: "json" };

// Write the bundles straight to where quarto-cli serves them from.
const outDir = "../../../src/resources/formats/html/ojs";

const config = {
  input: "src/index.js",
  output: {
    file: `${outDir}/quarto-ojs-runtime.js`,
    format: "esm",
    indent: false,
    // No build year here, so that rebuilding unchanged sources reproduces the
    // committed bundles exactly.
    banner: `// ${meta.name} v${meta.version} Copyright ${meta.author}`,
  },
  plugins: [
    nodeResolve({
      mainFields: ["module", "main"],
    }),
  ]
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: `${outDir}/quarto-ojs-runtime.min.js`,
    },
    plugins: [
      ...config.plugins,
      terser({
        mangle: {
          reserved: ["RequireError"]
        }
      }),
    ]
  }
];
