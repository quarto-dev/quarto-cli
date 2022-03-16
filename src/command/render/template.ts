/*
* template.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import * as ld from "../../core/lodash.ts";
import { basename, join } from "path/mod.ts";

import { kHtmlMathMethod, kSelfContained } from "../../config/constants.ts";
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

    // replace generator
    patchedTemplate = patchedTemplate.replace(
      /<meta name="generator" content="pandoc"\s*\/?>/,
      `<meta name="generator" content="quarto-${quartoConfig.version()}" \/>`,
    );

    return patchedTemplate;
  });
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
