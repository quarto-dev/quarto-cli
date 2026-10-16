import node from "@rollup/plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import meta from "./package.json" with {type: "json"};

const copyright = `// @observablehq/runtime v${meta.version} Copyright ${(new Date).getFullYear()} Observable, Inc.`;

function config(output) {
  return {
    input: "src/index.js",
    plugins: [
      node(),
      terser({
        toplevel: output.format === "es",
        output: {preamble: copyright},
        mangle: {
          reserved: [
            "FileAttachment",
            "RequireError",
            "DuckDBClient",
            "SQLiteDatabaseClient",
            "Workbook",
            "ZipArchive",
            "ZipArchiveEntry",
            "Runtime",
            "RuntimeError",
            "Variable",
            "Module",
            "Library",
            "Inspector",
          ]
        }
      })
    ],
    output
  };
}

export default [
  config({
    format: "es",
    file: "dist/runtime.js"
  }),
  config({
    format: "umd",
    extend: true,
    name: "observablehq",
    file: "dist/runtime.umd.js"
  })
];
