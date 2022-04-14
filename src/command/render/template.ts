/*
* template.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { basename, join } from "path/mod.ts";

import {
  FormatExtras,
  FormatTemplateContext,
  Metadata,
} from "../../config/types.ts";
import { TempContext } from "../../core/temp.ts";

export const kPatchedTemplateExt = ".patched";
export const kTemplatePartials = "template-partials";

export function readPartials(metadata: Metadata) {
  if (typeof (metadata?.[kTemplatePartials]) === "string") {
    metadata[kTemplatePartials] = [metadata[kTemplatePartials]];
  }
  return (metadata?.[kTemplatePartials] || []) as string[];
}

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
          await Deno.copyFile(partial, join(stagingDir, basename(partial)));
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
