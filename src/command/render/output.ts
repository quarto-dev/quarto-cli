/*
 * output.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  SEP_PATTERN,
} from "path/mod.ts";

import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { partitionYamlFrontMatter } from "../../core/yaml.ts";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml/mod.ts";

import {
  kOutputExt,
  kOutputFile,
  kPreserveYaml,
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
import { formatOutputFile } from "../../core/render.ts";
import { kYamlMetadataBlock } from "../../core/pandoc/pandoc-formats.ts";
import {
  typstPdfOutputRecipe,
  useTypstPdfOutputRecipe,
} from "./output-typst.ts";

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
    const outputFile = formatOutputFile(format);
    if (outputFile) {
      // https://github.com/quarto-dev/quarto-cli/issues/2440
      if (outputFile.match(SEP_PATTERN)) {
        throw new Error(
          `\nIn file ${context.target.source}\n  Invalid value for \`output-file\`: paths are not allowed`,
        );
      }
      output = join(dirname(input), outputFile);
    } else {
      output = "";
    }
  }

  if (useQuartoLatexmk(format, options.flags)) {
    return quartoLatexmkOutputRecipe(input, output, options, format);
  } else if (useContextPdfOutputRecipe(format, options.flags)) {
    return contextPdfOutputRecipe(input, output, options, format);
  } else if (useTypstPdfOutputRecipe(format)) {
    return typstPdfOutputRecipe(
      input,
      output,
      options,
      format,
      context.project,
    );
  } else {
    // default recipe spec based on user input
    const completeActions: VoidFunction[] = [];

    const recipe: OutputRecipe = {
      output,
      keepYaml: false,
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
      const to = format.pandoc.to;
      const variant = format.render[kVariant];

      recipe.format = {
        ...recipe.format,
        pandoc: {
          ...recipe.format.pandoc,
          to: `${to}${variant}`,
        },
      };

      // we implement +yaml_metadata_block internally to prevent
      // gunk from the quarto rendering pipeline from showing up
      if (recipe.format.pandoc.to?.includes(`+${kYamlMetadataBlock}`)) {
        recipe.keepYaml = true;
      }
    }

    // complete hook for keep-yaml
    // workaround for https://github.com/quarto-dev/quarto-cli/issues/5079
    if (recipe.keepYaml || recipe.format.render[kPreserveYaml]) {
      completeActions.push(() => {
        // read yaml and output markdown
        const inputMd = partitionYamlFrontMatter(context.target.markdown.value);
        if (inputMd) {
          const outputFile = isAbsolute(recipe.output)
            ? recipe.output
            : join(dirname(context.target.input), recipe.output);
          const output = Deno.readTextFileSync(outputFile);
          const outputMd = partitionYamlFrontMatter(
            Deno.readTextFileSync(outputFile),
          );
          // remove _quarto metadata
          //
          // this is required to avoid tests breaking due to the
          // _quarto regexp tests finding themselves in the output
          const yaml = parseYaml(
            inputMd.yaml.replace(/^---+\n/m, "").replace(/\n---+\n*$/m, "\n"),
          ) as Record<string, unknown>;
          delete yaml._quarto;
          const yamlString = `---\n${stringifyYaml(yaml)}---\n`;

          const markdown = outputMd?.markdown || output;
          Deno.writeTextFileSync(
            outputFile,
            yamlString + "\n\n" + markdown,
          );
        }
      });
    }

    if (!recipe.output) {
      // no output specified: derive an output path from the extension

      // derive new output file
      let output = inputStem + "." + ext;
      // special case for .md to .md, need to append the writer to create a
      // non-conflicting filename
      if (extname(input) === ".md" && ext === "md") {
        output = `${inputStem}-${format.identifier["base-format"]}.md`;
      }

      // special case if the source will overwrite the destination (note: this
      // behavior can be customized with a custom output-ext)
      if (output === basename(context.target.source)) {
        output = inputStem + `.${kOutExt}.` + ext;
      }

      // assign output
      updateOutput(output);
    } else if (recipe.output === kStdOut) {
      // output to stdout: direct pandoc to write to a temp file then we'll
      // forward to stdout (necessary b/c a postprocesor may need to act on
      // the output before its complete)
      updateOutput(options.services.temp.createFile({ suffix: "." + ext }));
      recipe.isOutputTransient = true;
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

const kOutExt = "out";
