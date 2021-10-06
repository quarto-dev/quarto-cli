/*
* output.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, extname, isAbsolute, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { partitionYamlFrontMatter } from "../../core/yaml.ts";
import { execProcess } from "../../core/process.ts";
import { binaryPath } from "../../core/resources.ts";
import { createSessionTempDir, sessionTempFile } from "../../core/temp.ts";
import { quartoConfig } from "../../core/quarto.ts";

import {
  kHtmlMathMethod,
  kKeepYaml,
  kOutputExt,
  kOutputFile,
  kSelfContained,
  kSelfContainedMath,
  kTemplate,
  kVariant,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { isHtmlOutput } from "../../config/format.ts";

import {
  quartoLatexmkOutputRecipe,
  useQuartoLatexmk,
} from "./latexmk/latexmk.ts";

import { havePandocArg, kStdOut, replacePandocOutputArg } from "./flags.ts";
import { OutputRecipe, RenderContext, RenderFlags } from "./types.ts";
import { resolveKeepSource } from "./codetools.ts";

// render commands imply the --output argument for pandoc and the final
// output file to create for the user, but we need a 'recipe' to go from
// this spec to what we should actually pass to pandoc on the command line.
// considerations include providing the default extension, dealing with
// output to stdout, and rendering pdfs (which can require an additional
// step after pandoc e.g. for latexmk)

export const kPatchedTemplateExt = ".patched";

export async function outputRecipe(
  context: RenderContext,
): Promise<OutputRecipe> {
  // alias
  const input = context.target.input;
  const options = context.options;
  const format = context.format;

  // determine if an output file was specified (could be on the command line or
  // could be within metadata)
  let output = options.flags?.output;
  if (!output) {
    const outputFile = format.pandoc[kOutputFile];
    if (outputFile) {
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

    // patch templates as necessary (don't patch if there is a user specified template)
    if (
      !format.pandoc[kTemplate] && !havePandocArg(recipe.args, "--template")
    ) {
      if (format.pandoc.to && isHtmlOutput(format.pandoc.to, true)) {
        recipe.format.pandoc[kTemplate] = await patchHtmlTemplate(
          format.pandoc.to,
          format,
          options.flags,
        );
      }
    }

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
        const inputMd = partitionYamlFrontMatter(
          Deno.readTextFileSync(input),
        );
        if (inputMd) {
          const outputMd = partitionYamlFrontMatter(
            Deno.readTextFileSync(recipe.output),
          );
          if (outputMd) {
            Deno.writeTextFileSync(
              recipe.output,
              inputMd.yaml + "\n\n" + outputMd.markdown,
            );
          }
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
      updateOutput(sessionTempFile({ suffix: "." + ext }));
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

async function patchHtmlTemplate(
  templateName: string,
  format: Format,
  flags?: RenderFlags,
) {
  return await patchTemplate(templateName, (template) => {
    // extract/capture css
    let css = "";
    let patchedTemplate = template.replace(
      /\$for\(css\)\$[\W\w]+?\$endfor\$/,
      (match) => {
        css = match;
        return "";
      },
    );
    if (css) {
      let patched = false;
      patchedTemplate = patchedTemplate.replace(/^<\/head>$/m, (match) => {
        patched = true;
        return css + "\n" + match;
      });
      // if we didn't patch it then revert to the original template
      if (!patched) {
        patchedTemplate = template;
      }
    }

    // extra stuff so reveal works with jupyter widgets
    if (templateName === "revealjs") {
      patchedTemplate = patchRevealsJsTemplate(template);
    }

    // make math evade self-contained
    if (
      ((flags && flags[kSelfContained]) || format.pandoc[kSelfContained]) &&
      !format.render[kSelfContainedMath]
    ) {
      const math = mathConfig(format, flags);
      if (math) {
        const mathTemplate = math.method === "mathjax"
          ? mathjaxScript(math.url)
          : math.method == "katex"
          ? katexScript(math.url)
          : "";

        if (mathTemplate) {
          patchedTemplate = patchedTemplate.replace(/\$math\$/, mathTemplate);
        }
      }
    }

    // replace generator
    patchedTemplate = patchedTemplate.replace(
      /<meta name="generator" content="pandoc" \/>/,
      `<meta name="generator" content="quarto-${quartoConfig.version()}" \/>`,
    );

    return patchedTemplate;
  });
}

function mathConfig(format: Format, flags?: RenderFlags) {
  // if any command line math flags were passed then bail
  if (
    flags?.mathjax || flags?.katex || flags?.webtex || flags?.gladtex ||
    flags?.mathml
  ) {
    return undefined;
  }

  const math = format.pandoc[kHtmlMathMethod];
  if (math === undefined || math === "mathjax") {
    return {
      method: "mathjax",
      url: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml-full.js",
    };
  } else if (math === "katex") {
    return {
      method: "katex",
      url: "https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/",
    };
  } else if (ld.isObject(math)) {
    const mathMethod = math as { method: string; url: string };
    if (
      (mathMethod.method === "mathjax" || mathMethod.method === "katex") &&
      typeof (mathMethod.url) === "string"
    ) {
      return mathMethod;
    }
  }
}

function mathjaxScript(url: string) {
  return `
  <script>
    (function () {
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src  = "${url}";
      document.getElementsByTagName("head")[0].appendChild(script);
    })();
  </script>
`;
}

function katexScript(url: string) {
  url = url.trim();
  if (!url.endsWith("/")) {
    url += "/";
  }
  return `
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      var head = document.getElementsByTagName("head")[0];
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "${url}katex.min.css";
      head.appendChild(link);

      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src  = "${url}katex.min.js";
      script.async = false;
      script.addEventListener('load', function() {
        var mathElements = document.getElementsByClassName("math");
          var macros = [];
          for (var i = 0; i < mathElements.length; i++) {
            var texText = mathElements[i].firstChild;
            if (mathElements[i].tagName == "SPAN") {
              window.katex.render(texText.data, mathElements[i], {
                displayMode: mathElements[i].classList.contains('display'),
                throwOnError: false,
                macros: macros,
                fleqn: false
              });
            }
          }
      });
      head.appendChild(script);
    });
  </script>
  `;
}

function patchRevealsJsTemplate(template: string) {
  template = template.replace(
    /(<script src="\$revealjs-url\$\/dist\/reveal.js"><\/script>)/m,
    "<script>window.backupDefine = window.define; window.define = undefined;</script>\n  $1",
  );
  template = template.replace(
    /(<script src="\$revealjs-url\$\/plugin\/math\/math.js"><\/script>\n\$endif\$)/,
    "$1\n  <script>window.define = window.backupDefine; window.backupDefine = undefined;</script>\n",
  );
  return template;
}

async function patchTemplate(
  format: string,
  patch: (template: string) => string,
) {
  // get the default pandoc template for the format
  const result = await execProcess({
    cmd: [binaryPath("pandoc"), "-D", format],
    stdout: "piped",
  });

  // transform it
  if (result.success) {
    const patched = patch(result.stdout!);

    // write a temp file w/ the patched template
    const templateDir = createSessionTempDir();
    const template = await Deno.makeTempFile(
      { suffix: kPatchedTemplateExt, dir: templateDir },
    );
    await Deno.writeTextFile(template, patched);

    return template;
  } else {
    throw new Error();
  }
}
