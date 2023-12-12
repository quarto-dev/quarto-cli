/*
 * template.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { basename, isAbsolute, join } from "path/mod.ts";
import {
  kEmbedResources,
  kHtmlMathMethod,
  kSelfContained,
  kSelfContainedMath,
} from "../../config/constants.ts";

import {
  Format,
  FormatExtras,
  FormatTemplateContext,
  Metadata,
} from "../../config/types.ts";
import { copyTo } from "../../core/copy.ts";
import { PandocOptions, RenderFlags } from "./types.ts";
import * as ld from "../../core/lodash.ts";
import { isHtmlDocOutput, isRevealjsOutput } from "../../config/format.ts";
import { expandGlobSync } from "fs/mod.ts";
import { normalizePath } from "../../core/path.ts";

export const kPatchedTemplateExt = ".patched";
export const kTemplatePartials = "template-partials";

/**
 * read and expand template partial globs
 *
 * @param metadata
 * @param cwd current working directory for glob expansion
 */
export function readPartials(metadata: Metadata, inputDir?: string) {
  if (typeof (metadata?.[kTemplatePartials]) === "string") {
    metadata[kTemplatePartials] = [metadata[kTemplatePartials]];
  }
  const result = (metadata?.[kTemplatePartials] || []) as string[];

  inputDir = inputDir ? normalizePath(inputDir) : undefined;
  const resolvePath = (path: string) => {
    if (!inputDir || isAbsolute(path)) {
      return path;
    } else {
      return join(inputDir, path);
    }
  };

  return result.flatMap((path) => {
    const result = [];
    for (const walk of expandGlobSync(resolvePath(path))) {
      result.push(walk.path);
    }
    return result;
  });
}

export async function stageTemplate(
  options: PandocOptions,
  extras: FormatExtras,
  userContext?: FormatTemplateContext,
) {
  const stagingDir = options.services.temp.createDir();
  const template = "template.patched";

  const stageContext = (
    dir: string,
    template: string,
    context?: FormatTemplateContext,
  ) => {
    if (context) {
      if (context.template) {
        const targetFile = join(dir, template);
        copyTo(context.template, targetFile);
        // Ensure that file is writable
        if (Deno.build.os !== "windows") {
          Deno.chmodSync(targetFile, 0o666);
        }
      }

      if (context.partials) {
        for (const partial of context.partials) {
          // TODO: Confirm that partial is a file not a directory
          copyTo(partial, join(stagingDir, basename(partial)));
        }
      }
      return true;
    } else {
      return false;
    }
  };

  const formatStaged = stageContext(
    stagingDir,
    template,
    extras.templateContext,
  );
  const userStaged = await stageContext(stagingDir, template, userContext);
  if (formatStaged || userStaged) {
    // The path to the newly staged template
    const stagedTemplatePath = join(stagingDir, template);

    // Apply any patches now that the template is staged
    applyTemplatePatches(stagedTemplatePath, options.format, options.flags);

    // Return the path to the template
    return stagedTemplatePath;
  } else {
    return undefined;
  }
}

export function cleanTemplatePartialMetadata(
  metadata: Metadata,
  builtIns: string[],
) {
  const partials = metadata[kTemplatePartials] as string[] | undefined;
  if (partials) {
    const cleansed = partials.filter((part) => builtIns.includes(part));
    if (cleansed.length === 0) {
      delete metadata[kTemplatePartials];
    } else {
      metadata[kTemplatePartials] = cleansed;
    }
  }
}

interface TemplatePatch {
  searchValue: RegExp;
  contents: string;
}

function applyTemplatePatches(
  template: string,
  format: Format,
  flags?: RenderFlags,
) {
  // The patches to apply
  const patches: TemplatePatch[] = [];

  // make math evade self-contained for HTML and Reveal
  if (isHtmlDocOutput(format.pandoc) || isRevealjsOutput(format.pandoc)) {
    if (
      ((flags && flags[kSelfContained]) || format.pandoc[kSelfContained] ||
        (flags && flags[kEmbedResources]) || format.pandoc[kEmbedResources]) &&
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
          patches.push({
            searchValue: /\$math\$/,
            contents: mathTemplate,
          });
        }
      }
    }
  }

  // Apply any patches
  if (patches.length) {
    let templateContents = Deno.readTextFileSync(template);
    patches.forEach((patch) => {
      templateContents = templateContents.replace(
        patch.searchValue,
        patch.contents,
      );
    });
    Deno.writeTextFileSync(template, templateContents);
  }
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
