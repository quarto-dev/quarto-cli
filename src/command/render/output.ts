/*
* output.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { isAbsolute, join, relative } from "path/mod.ts";

import { Format, FormatPandoc } from "../../api/format.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem } from "../../core/path.ts";

import { kStdOut, replacePandocArg } from "./flags.ts";
import { PandocOptions } from "./pandoc.ts";
import { RenderOptions } from "./render.ts";
import { tinyTexOutputRecipe, useTinyTex } from "./tinytex.ts";

// render command lines imply the --output argument for pandoc and the final
// output file to create for the user, but we need a 'recipe' to go from
// this spec to what we should actually pass on the command line. considerations
// include providing the default extension, dealing with output to stdout,
// and rendering pdfs (which require an additional step after pandoc)

export interface OutputRecipe {
  // --output file that pandoc will produce
  output: string;
  // transformed pandoc args reflecting 'output'
  args: string[];
  // modifications to pandoc format spec
  pandoc: FormatPandoc;
  // callback for completing the output recipe (e.g. might run pdflatex, etc.).
  // can optionally return an alternate output path. passed the actual
  // options used to run pandoc (for deducing e.g. pdf engine options)
  complete: (options: PandocOptions) => Promise<string | undefined>;
}

export function outputRecipe(
  input: string,
  options: RenderOptions,
  format: Format,
): OutputRecipe {
  if (useTinyTex(input, format, options.flags)) {
    // use tinytex for pdfs created w/ pdflatex, xelatex, and lualatex
    return tinyTexOutputRecipe(options, format);
  } else {
    // default recipe spec based on user input
    const recipe = {
      output: options.flags?.output!,
      args: options.pandocArgs || [],
      pandoc: {},
      complete: async (): Promise<string | undefined> => {
        return;
      },
    };

    // some path attributes
    const ext = format.output?.ext || "html";
    const [inputDir, inputStem] = dirAndStem(options.input);

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
