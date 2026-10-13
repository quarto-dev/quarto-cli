import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from "@rollup/plugin-terser";
import meta from "./package.json" with { type: "json" };

const config = {
  input: "src/index.js",
  output: {
    file: "dist/quarto-ojs-runtime.js",
    format: "esm",
    indent: false,
    banner: `// ${meta.name} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author}`,
  },
  plugins: [
    nodeResolve({
      mainFields: ["module", "main"],
    }),
    // The compiler's dist/index.js is UMD. Inline it eagerly, as
    // @rollup/plugin-commonjs did before v27 made strictRequires the default.
    commonjs({ strictRequires: false }),
  ]
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: "dist/quarto-ojs-runtime.min.js",
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
