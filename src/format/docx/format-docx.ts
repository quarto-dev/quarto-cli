/*
* format-docx.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kFilterParams } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createWordprocessorFormat } from "../formats-shared.ts";

const kIconCaution = "icon-caution";
const kIconImportant = "icon-important";
const kIconNote = "icon-note";
const kIconTip = "icon-tip";
const kIconWarning = "icon-warning";

export function docxFormat(): Format {
  return mergeConfigs(
    createWordprocessorFormat("MS Word", "docx"),
    {
      formatExtras: () => {
        return {
          [kFilterParams]: {
            [kIconCaution]: iconPath("caution.png"),
            [kIconImportant]: iconPath("important.png"),
            [kIconNote]: iconPath("note.png"),
            [kIconTip]: iconPath("tip.png"),
            [kIconWarning]: iconPath("warning.png"),
          },
        };
      },
      extensions: {
        book: {
          selfContainedOutput: true,
        },
      },
    },
  );
}

function iconPath(icon: string) {
  return formatResourcePath("docx", icon);
}
