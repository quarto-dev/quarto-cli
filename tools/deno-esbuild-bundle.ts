import * as esbuild from "npm:esbuild@0.20.2";
// Import the Wasm build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@0.20.2/wasm.js";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";


const importMapURL = `file://${Deno.cwd()}/import_map.json`;
// console.log("importMapURL", importMapURL);

await esbuild.build({
  plugins: [...denoPlugins({ importMapURL })],
  entryPoints: ["./quarto.ts"],
  outfile: "../package/pkg-working/bin/quarto.js",
  bundle: true,
  format: "esm",
});

esbuild.stop();