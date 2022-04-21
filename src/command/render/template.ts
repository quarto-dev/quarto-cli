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
import { copyTo } from "../../core/copy.ts";
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

  const stageContext = (
    dir: string,
    template: string,
    context?: FormatTemplateContext,
  ) => {
    if (context) {
      if (context.template) {
        copyTo(context.template, join(dir, template));
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
    return join(stagingDir, template);
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
