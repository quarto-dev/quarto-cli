import { basename, isAbsolute, join, relative } from "path/mod.ts";

import { Format } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";

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
    // provide an output destination for pandoc
    recipe.output = Deno.makeTempFileSync({ dir: inputDir, suffix: ".tex" });
    recipe.output = relative(inputDir, recipe.output);
    recipe.args = replacePandocArg(recipe.args, "--output", recipe.output);

    // when pandoc is done, we need to run pdf latex, and copy the
    // ouptut to the user's requested destination
    recipe.complete = async () => {
      // TODO: these need to be nicer looking filenames

      // TODO: make sure all the keep stuff actually works

      // run pdflatex
      const texFile = join(inputDir, recipe.output);
      const pdfFile = basename(recipe.output, ".tex") + ".pdf";
      const result = await execProcess({
        cmd: ["pdflatex", texFile],
        cwd: inputDir,
      });
      if (!result.success) {
        return Promise.reject();
      }

      // remove tex if it's not being kept
      if (options.flags?.keepAll || format.keep?.tex) {
        console.log("keeping tex");
        Deno.renameSync(texFile, join(inputStem + ".tex"));
      } else {
        Deno.removeSync(texFile);
      }

      let output = options.flags?.output;
      if (!output) {
        output = join(inputStem + ".pdf");
        Deno.renameSync(pdfFile, output);
      } else if (recipe.output === kStdOut) {
        writeFileToStdout(pdfFile);
        Deno.removeSync(pdfFile);
      } else {
        Deno.renameSync(pdfFile, output);
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
