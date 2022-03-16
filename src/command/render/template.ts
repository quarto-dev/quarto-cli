/*
* template.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import * as ld from "../../core/lodash.ts";
import { basename, join } from "path/mod.ts";

import {
  kHtmlMathMethod,
  kSelfContained,
  kSelfContainedMath,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  FormatTemplateContext,
} from "../../config/types.ts";
import { execProcess } from "../../core/process.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { pandocBinaryPath } from "../../core/resources.ts";
import { TempContext } from "../../core/temp.ts";
import { RenderFlags } from "./types.ts";

export const kPatchedTemplateExt = ".patched";
export const kTemplatePartials = "template-partials";

export async function stageTemplate(
  extras: FormatExtras,
  temp: TempContext,
  userContext?: FormatTemplateContext,
) {
  const stagingDir = temp.createDir();
  const template = "template.patched";

  const stageContext = async (
    dir: string,
    template: string,
    context?: FormatTemplateContext,
  ) => {
    if (context) {
      if (context.template) {
        await Deno.copyFile(context.template, join(dir, template));
      }

      if (context.partials) {
        for (const partial of context.partials) {
          // TODO: Confirm that partial is a file not a directory
          Deno.copyFile(partial, join(stagingDir, basename(partial)));
        }
      }
      return true;
    } else {
      return false;
    }
  };

  const formatStaged = await stageContext(
    stagingDir,
    template,
    extras.templateContext,
  );
  const userStaged = await stageContext(stagingDir, template, userContext);
  if (formatStaged || userStaged) {
    return join(stagingDir, template);
  } else {
    return undefined;
  }
}

export async function patchHtmlTemplate(
  templateName: string,
  format: Format,
  temp: TempContext,
  patches?: Array<(template: string) => string>,
  flags?: RenderFlags,
) {
  return await patchTemplate(templateName, temp, (template) => {
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

    // apply extra patches
    if (patches) {
      for (const patch of patches) {
        patchedTemplate = patch(patchedTemplate);
      }
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
      /<meta name="generator" content="pandoc"\s*\/?>/,
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

async function patchTemplate(
  format: string,
  temp: TempContext,
  patch: (template: string) => string,
) {
  // get the default pandoc template for the format
  const result = await execProcess({
    cmd: [pandocBinaryPath(), "-D", format],
    stdout: "piped",
  });

  // transform it
  if (result.success) {
    const patched = patch(result.stdout!);

    // write a temp file w/ the patched template
    const templateDir = temp.createDir();
    const template = await Deno.makeTempFile(
      { suffix: kPatchedTemplateExt, dir: templateDir },
    );
    await Deno.writeTextFile(template, patched);

    return template;
  } else {
    throw new Error();
  }
}
