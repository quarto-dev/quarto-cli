import { isAbsolute, join, relative } from "path/mod.ts";

import { Format } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { isPdfOutput, pdfOutputRecipe } from "./output-pdf.ts";
import { RenderOptions } from "./render.ts";

// render command lines imply the --output argument for pandoc and the final
// output file to create for the user, but we need a 'recipe' to go from
// this spec to what we should actually pass on the command line. considerations
// include providing the default extension, dealing with output to stdout,
// and rendering pdfs (which require an additional step after pandoc)
export function outputRecipe(
  options: RenderOptions,
  inputDir: string,
  inputStem: string,
  format: Format,
) {
  // alias & provide defaults for some variables
  const writer = format.pandoc?.writer;
  const ext = format.output?.ext || "html";

  // pdfs have their own special set of rules
  if (isPdfOutput(writer, ext)) {
    return pdfOutputRecipe(options, inputDir, inputStem, format);
  } else {
    // default recipe spec based on user input
    const recipe = {
      output: options.flags?.output!,
      args: options.pandocArgs || [],
      complete: async (): Promise<string | undefined> => {
        return;
      },
    };

    if (!recipe.output) {
      // no output on the command line: derive an output path from the extension
      recipe.output = join(inputStem + "." + ext);
      recipe.args.unshift("--output", recipe.output);
    } else if (recipe.output === kStdOut) {
      // output to stdout: direct pandoc to write to a temp file then we'll
      // forward to stdout (necessary b/c a postprocesor may need to act on
      // the output before its complete)
      recipe.output = Deno.makeTempFileSync({ suffix: "." + ext });
      recipe.complete = async () => {
        writeFileToStdout(recipe.output);
        Deno.removeSync(recipe.output);
        return undefined;
      };
    } else if (!isAbsolute(recipe.output)) {
      // relatve output file on the command line: make it relative to the input dir
      // for pandoc (which will run in the input dir)
      recipe.output = relative(inputDir, recipe.output);
      recipe.args = replacePandocArg(recipe.args, "--output", recipe.output);
    }

    // return
    return recipe;
  }
}
