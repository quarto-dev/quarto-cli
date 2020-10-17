import { basename, isAbsolute, join, relative } from "path/mod.ts";

import { Format } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { removeIfExists } from "../../core/path.ts";

import { execProcess } from "../../core/process.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { RenderOptions } from "./render.ts";

// resole output file and --output argument based on input, target ext, and any provided args
export function outputRecipe(
  options: RenderOptions,
  inputDir: string,
  inputStem: string,
  format: Format,
) {
  // alias some variables
  const writer = format.pandoc?.writer;
  const ext = format.output?.ext || "html";

  // these variables constitute the recipe
  const recipe = {
    output: options.flags?.output!,
    args: options.pandocArgs || [],
    complete: async (): Promise<string | undefined> => {
      return;
    },
  };

  // if the writer is latex or beamer, and the extension is pdf, then we need to
  // change the extension to .tex and arrange to process the pdf after the fact
  if (["latex", "beamer"].includes(writer || "") && ext === "pdf") {
    // provide an output destination for pandoc (remove chars that latex might have trobule with)
    const safeInputStem = inputStem
      .replaceAll(/[ <>()|\:&;#?*']/g, "-");
    recipe.output = safeInputStem + ".quarto.tex";
    recipe.args = replacePandocArg(recipe.args, "--output", recipe.output);

    // when pandoc is done, we need to run pdf latex, and copy the
    // ouptut to the user's requested destination
    recipe.complete = async () => {
      // run pdflatex
      const texFile = recipe.output;
      const texStem = basename(texFile, ".tex");
      const result = await execProcess({
        cmd: ["pdflatex", texFile],
        cwd: inputDir,
      });
      if (!result.success) {
        return Promise.reject();
      }

      // cleanup intermediates
      ["toc", "out", "aux", "log"].forEach((ext) => {
        removeIfExists(join(inputDir, texStem + "." + ext));
      });

      // keep tex if requested
      const compileTex = join(inputDir, texFile);
      const outputTex = join(inputDir, safeInputStem + ".tex");
      if (options.flags?.keepAll || format.keep?.tex) {
        Deno.renameSync(compileTex, outputTex);
      } else {
        Deno.removeSync(compileTex);
        removeIfExists(outputTex); // from previous renders
      }

      const compilePdf = join(inputDir, texStem + ".pdf");
      let output = options.flags?.output;
      if (!output) {
        output = join(inputDir, safeInputStem + ".pdf");
        Deno.renameSync(compilePdf, output);
      } else if (recipe.output === kStdOut) {
        writeFileToStdout(compilePdf);
        Deno.removeSync(compilePdf);
      } else {
        Deno.renameSync(compilePdf, output);
      }
      return output;
    };

    // no output on the command line: insert our derived output file path
  } else if (!recipe.output) {
    recipe.output = join(inputStem + "." + ext);
    recipe.args.unshift("--output", recipe.output);
    // output to stdout
  } else if (recipe.output === kStdOut) {
    recipe.output = Deno.makeTempFileSync({ suffix: "." + ext });
    recipe.complete = async () => {
      writeFileToStdout(recipe.output);
      Deno.removeSync(recipe.output);
      return undefined;
    };

    // relatve output file on the command line: make it relative to the input dir
  } else if (!isAbsolute(recipe.output)) {
    recipe.output = relative(inputDir, recipe.output);
    recipe.args = replacePandocArg(recipe.args, "--output", recipe.output);
  }

  // return
  return recipe;
}
