import node from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default {
  input: "src/index.js",
  output: [
    {
      compact: true,
      file: "dist/index.js",
      format: "umd",
      name: "unofficial_observablehq_compiler"
    },
    {
      compact: true,
      file: "dist/index-esm.js",
      format: "esm",
      name: "esm"
    }
  ],
  plugins: [node(), commonjs()]
};
