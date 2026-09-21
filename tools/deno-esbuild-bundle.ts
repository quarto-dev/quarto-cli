import * as esbuild from "npm:esbuild@0.27.1";
// Import the Wasm build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@0.20.2/wasm.js";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
import { assert } from "https://deno.land/std@0.196.0/testing/asserts.ts";

const importMapURL = `file://${Deno.cwd()}/import_map.json`;
// console.log("importMapURL", importMapURL);

await esbuild.build({
  plugins: [...denoPlugins({ importMapURL })
    // I wish I could do it this way, but it doesn't work; either
    // the plugin is called with an unresolved name before import map,
    // or the plugin isn't called at all..
    // , {
    // "name": "quarto-build-remove-eslint-disable-next-line",
    // setup(build: any) {
    //   build.onLoad({ filter: /DOMWorld\.js/ }, async (args: any) => {
    //     console.log("HERE!!?!?!");
    //     const contents = await Deno.readTextFile(args.path);
    //     assert(contents.indexOf("eslint-disable-next-line") !== -1);
    //     const newContents = contents.replace("eslint-disable-next-line", "");
    //     return {
    //       contents: newContents,
    //       loader: "js",
    //     };
    //   });
    // }
    // }
  ],
  entryPoints: ["./quarto.ts"],
  outfile: "../package/pkg-working/bin/quarto.js",
  bundle: true,
  format: "esm",
});
esbuild.stop();
// extremely gross to have to do it this way, but apparently esbuild
// plugins don't compose nicely (or at least the deno plugin doesn't)

let out = Deno.readTextFileSync("../package/pkg-working/bin/quarto.js");
out = out.replace("eslint-disable-next-line", "");
Deno.writeTextFileSync("../package/pkg-working/bin/quarto.js", out);