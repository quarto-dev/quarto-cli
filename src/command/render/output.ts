/*
* output.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, extname, isAbsolute, join, relative } from "path/mod.ts";

import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { partitionYamlFrontMatter } from "../../core/yaml.ts";

import {
  kKeepYaml,
  kOutputExt,
  kOutputFile,
  kVariant,
} from "../../config/constants.ts";

import {
  quartoLatexmkOutputRecipe,
  useQuartoLatexmk,
} from "./latexmk/latexmk.ts";

import { kStdOut, replacePandocOutputArg } from "./flags.ts";
import { OutputRecipe, RenderContext } from "./types.ts";
import { resolveKeepSource } from "./codetools.ts";
import {
  contextPdfOutputRecipe,
  useContextPdfOutputRecipe,
} from "./output-tex.ts";

// render commands imply the --output argument for pandoc and the final
// output file to create for the user, but we need a 'recipe' to go from
// this spec to what we should actually pass to pandoc on the command line.
// considerations include providing the default extension, dealing with
// output to stdout, and rendering pdfs (which can require an additional
// step after pandoc e.g. for latexmk)

export function outputRecipe(
  context: RenderContext,
): OutputRecipe {
  // alias
  const input = context.target.input;
  const options = context.options;
  const format = context.format;

  // determine if an output file was specified (could be on the command line or
  // could be within metadata)
  let output = options.flags?.output;
  if (!output) {
    let outputFile = format.pandoc[kOutputFile];
    if (outputFile) {
      if (!outputFile.match(/\..+$/) && format.render[kOutputExt]) {
        outputFile = `${outputFile}.${format.render[kOutputExt]}`;
      }
      if (isAbsolute(outputFile)) {
        output = outputFile;
      } else {
        output = join(dirname(input), outputFile);
      }
    } else {
      output = "";
    }
  }

  if (useQuartoLatexmk(format, options.flags)) {
    return quartoLatexmkOutputRecipe(input, output, options, format);
  } else if (useContextPdfOutputRecipe(format, options.flags)) {
    return contextPdfOutputRecipe(input, output, options, format);
  } else {
    // default recipe spec based on user input
    const completeActions: VoidFunction[] = [];

    const recipe = {
      output,
      args: options.pandocArgs || [],
      format: { ...format },
      complete: (): Promise<string | void> => {
        completeActions.forEach((action) => action());
        return Promise.resolve();
      },
    };

    // keep source if requested (via keep-source or code-tools), we are targeting html,
    // and engine can keep it (e.g. we wouldn't keep an .ipynb file as source)
    resolveKeepSource(recipe.format, context.engine, context.target);

    // helper function to re-write output
    const updateOutput = (output: string) => {
      recipe.output = output;
      if (options.flags?.output) {
        recipe.args = replacePandocOutputArg(recipe.args, output);
      } else {
        recipe.format.pandoc[kOutputFile] = output;
      }
    };

    // determine ext
    const ext = format.render[kOutputExt] || "html";

    // compute dir and stem
    const [inputDir, inputStem] = dirAndStem(input);

    // tweak pandoc writer if we have extensions declared
    if (format.render[kVariant]) {
      recipe.format = {
        ...recipe.format,
        pandoc: {
          ...recipe.format.pandoc,
          to: `${format.pandoc.to}${format.render[kVariant]}`,
        },
      };
    }

    // complete hook for keep-yaml
    if (format.render[kKeepYaml]) {
      completeActions.push(() => {
        // read yaml and output markdown
        const inputMd = partitionYamlFrontMatter(context.target.markdown.value);
        if (inputMd) {
          const outputFile = join(dirname(context.target.input), recipe.output);
          const output = Deno.readTextFileSync(outputFile);
          const outputMd = partitionYamlFrontMatter(
            Deno.readTextFileSync(outputFile),
          );
          const markdown = outputMd?.markdown || output;
          Deno.writeTextFileSync(
            outputFile,
            inputMd.yaml + "\n\n" + markdown,
          );
        }
      });
    }

    if (!recipe.output) {
      // no output specified: derive an output path from the extension

      // special case for .md to .md, need to use the writer to create a unique extension
      let outputExt = ext;
      if (extname(input) === ".md" && ext === "md") {
        outputExt = `${format.pandoc.to}.md`;
      }
      updateOutput(inputStem + "." + outputExt);
    } else if (recipe.output === kStdOut) {
      // output to stdout: direct pandoc to write to a temp file then we'll
      // forward to stdout (necessary b/c a postprocesor may need to act on
      // the output before its complete)
      updateOutput(options.services.temp.createFile({ suffix: "." + ext }));
      completeActions.push(() => {
        writeFileToStdout(recipe.output);
        Deno.removeSync(recipe.output);
      });
    } else if (!isAbsolute(recipe.output)) {
      // relatve output file on the command line: make it relative to the input dir
      // for pandoc (which will run in the input dir)
      updateOutput(relative(inputDir, recipe.output));
    } else {
      // absolute path may need ~ substitution
      updateOutput(expandPath(recipe.output));
    }

    // return
    return recipe;
  }
}
