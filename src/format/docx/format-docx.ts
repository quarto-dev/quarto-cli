/*
* format-docx.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kFilterParams } from "../../config/constants.ts";
import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createWordprocessorFormat } from "../formats.ts";

const kIconCaution = "icon-caution";
const kIconImportant = "icon-important";
const kIconNote = "icon-note";
const kIconTip = "icon-tip";
const kIconWarning = "icon-warning";

export function docxFormat(): Format {
  return mergeConfigs(
    createWordprocessorFormat("docx"),
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
        book: {},
      },
    },
  );
}

function iconPath(icon: string) {
  return formatResourcePath("docx", icon);
}
